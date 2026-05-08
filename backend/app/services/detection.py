import os
import uuid
import time
import asyncio
import aiofiles
from pathlib import Path
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.defect import Defect
from app.config import settings
from app.metrics import defect_detections_total, detection_duration_seconds

MODEL_PATH = Path(__file__).resolve().parent.parent.parent / "models" / "best.pt"

SEVERITY_MAP = {
    "alligator cracks": "critical",
    "potholes": "high",
    "rutting": "high",
    "longitudnal_cracks": "medium",
    "transverse cracks": "medium",
    "manhole covers": "medium",
    "patchy road sections": "medium",
    "lane line blurs": "low",
    "destrian crossing blurs": "low",
    "repaired cracks": "low",
}

_model = None


def _load_model():
    global _model
    if _model is None:
        from ultralytics import YOLO
        _model = YOLO(str(MODEL_PATH))
    return _model


def _infer_image(filepath: str) -> list[dict]:
    model = _load_model()
    results = model.predict(filepath, imgsz=896, conf=0.25, iou=0.45, verbose=False)
    detections = []
    for r in results:
        for box in r.boxes:
            class_name = model.names[int(box.cls)]
            detections.append({
                "defect_type": class_name,
                "severity": SEVERITY_MAP.get(class_name, "medium"),
                "confidence": round(float(box.conf), 2),
            })
    return detections


def _infer_video(filepath: str) -> list[dict]:
    import cv2
    model = _load_model()
    cap = cv2.VideoCapture(filepath)
    frame_idx = 0
    best_by_class: dict[str, float] = {}
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % 10 == 0:
            results = model.predict(frame, imgsz=896, conf=0.25, iou=0.45, verbose=False)
            for r in results:
                for box in r.boxes:
                    cls = model.names[int(box.cls)]
                    conf = round(float(box.conf), 2)
                    if best_by_class.get(cls, 0) < conf:
                        best_by_class[cls] = conf
        frame_idx += 1
    cap.release()
    return [
        {"defect_type": cls, "severity": SEVERITY_MAP.get(cls, "medium"), "confidence": conf}
        for cls, conf in best_by_class.items()
    ]


class DetectionService:
    async def _save_file(self, file: UploadFile) -> str:
        os.makedirs(settings.upload_dir, exist_ok=True)
        filename = f"{uuid.uuid4()}_{file.filename}"
        filepath = os.path.join(settings.upload_dir, filename)
        async with aiofiles.open(filepath, "wb") as f:
            await f.write(await file.read())
        return filepath

    async def process_image(self, file: UploadFile, lat, lng, address, db: AsyncSession):
        filepath = await self._save_file(file)

        t0 = time.perf_counter()
        loop = asyncio.get_event_loop()
        raw = await loop.run_in_executor(None, _infer_image, filepath)
        detection_duration_seconds.labels(source_type="image").observe(time.perf_counter() - t0)

        detections = []
        for det in raw:
            defect = Defect(
                defect_type=det["defect_type"],
                severity=det["severity"],
                confidence=det["confidence"],
                lat=lat,
                lng=lng,
                address=address,
                photo_path=filepath,
                source_type="image",
            )
            db.add(defect)
            detections.append(defect)
            defect_detections_total.labels(
                defect_type=det["defect_type"],
                severity=det["severity"],
                source_type="image",
            ).inc()

        await db.commit()
        for d in detections:
            await db.refresh(d)
        return detections

    async def process_video(self, file: UploadFile, lat, lng, address, db: AsyncSession):
        filepath = await self._save_file(file)

        t0 = time.perf_counter()
        loop = asyncio.get_event_loop()
        raw = await loop.run_in_executor(None, _infer_video, filepath)
        detection_duration_seconds.labels(source_type="video").observe(time.perf_counter() - t0)

        count = len(raw)
        for det in raw:
            db.add(Defect(
                defect_type=det["defect_type"],
                severity=det["severity"],
                confidence=det["confidence"],
                lat=lat,
                lng=lng,
                address=address,
                source_type="video",
            ))
            defect_detections_total.labels(
                defect_type=det["defect_type"],
                severity=det["severity"],
                source_type="video",
            ).inc()

        await db.commit()
        return {"message": f"Видео обработано, обнаружено дефектов: {count}", "count": count}
