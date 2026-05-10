import os
import uuid
import time
import asyncio
import aiofiles
import cv2
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
    "pedestrian crossing blurs": "low",
    "repaired cracks": "low",
}

RUSSIAN_NAMES = {
    "alligator cracks": "Сетка трещин",
    "lane line blurs": "Потёртость разметки",
    "longitudnal_cracks": "Продольные трещины",
    "manhole covers": "Люки",
    "patchy road sections": "Ремонтные карты",
    "pedestrian crossing blurs": "Потёртость пеш. перехода",
    "potholes": "Выбоины",
    "repaired cracks": "Заделанные трещины",
    "rutting": "Колейность",
    "transverse cracks": "Поперечные трещины",
}

_model = None


def _load_model():
    global _model
    if _model is None:
        from ultralytics import YOLO
        _model = YOLO(str(MODEL_PATH))
    return _model


def _save_annotated(img_bgr, prefix: str) -> str:
    os.makedirs(settings.upload_dir, exist_ok=True)
    filename = f"{prefix}_{uuid.uuid4().hex[:8]}.jpg"
    path = os.path.join(settings.upload_dir, filename)
    cv2.imwrite(path, img_bgr)
    return f"/uploads/{filename}"


def _infer_image(filepath: str) -> tuple[list[dict], str | None]:
    model = _load_model()
    results = model.predict(filepath, imgsz=896, conf=0.25, iou=0.45, verbose=False)
    detections = []
    annotated_url = None
    for r in results:
        r.names = {i: RUSSIAN_NAMES.get(name, name) for i, name in model.names.items()}
        annotated_url = _save_annotated(r.plot(), "ann")
        for box in r.boxes:
            class_name = model.names[int(box.cls)]
            if class_name == "manhole covers":
                continue
            detections.append({
                "defect_type": class_name,
                "severity": SEVERITY_MAP.get(class_name, "medium"),
                "confidence": round(float(box.conf), 2),
            })
    return detections, annotated_url


def _infer_video(filepath: str) -> tuple[list[dict], list[str]]:
    model = _load_model()
    cap = cv2.VideoCapture(filepath)
    frame_idx = 0
    best_by_class: dict[str, dict] = {}
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % 10 == 0:
            results = model.track(frame, imgsz=896, conf=0.25, iou=0.45, verbose=False, tracker="bytetrack.yaml", persist=True)
            for r in results:
                for box in r.boxes:
                    cls = model.names[int(box.cls)]
                    if cls == "manhole covers":
                        continue
                    conf = round(float(box.conf), 2)
                    if best_by_class.get(cls, {}).get("conf", 0) < conf:
                        r.names = {i: RUSSIAN_NAMES.get(n, n) for i, n in model.names.items()}
                        r.boxes.id = None
                        best_by_class[cls] = {"conf": conf, "frame": r.plot()}
        frame_idx += 1
    cap.release()

    detections = []
    frame_urls = []
    for cls, data in best_by_class.items():
        detections.append({
            "defect_type": cls,
            "severity": SEVERITY_MAP.get(cls, "medium"),
            "confidence": data["conf"],
        })
        frame_urls.append(_save_annotated(data["frame"], f"frame_{cls.replace(' ', '_')}"))
    return detections, frame_urls


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
        raw, annotated_url = await loop.run_in_executor(None, _infer_image, filepath)
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
        return detections, annotated_url
