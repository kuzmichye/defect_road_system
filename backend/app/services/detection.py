import os
import uuid
import time
import asyncio
import aiofiles
import subprocess
import cv2
import json
import urllib.request
from collections import defaultdict
from pathlib import Path
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.defect import Defect
from app.config import settings
from app.metrics import defect_detections_total, detection_duration_seconds


def _reverse_geocode(lat: float, lng: float) -> str:
    url = f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lng}&format=json"
    req = urllib.request.Request(url, headers={"User-Agent": "DefectRoadApp/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
            return data.get("display_name", "")
    except Exception:
        return ""

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
BLUR_THRESHOLD = 30  # Laplacian variance below this → frame is too blurry for inference
SAHI_TILE_SIZE = 960   # crop size in pixels before passing to YOLO
SAHI_OVERLAP = 0.2     # tile overlap fraction
SAHI_INTERVAL = 10     # run SAHI every N frames (performance vs recall trade-off)


def _apply_clahe(img_bgr):
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    return cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)


def _apply_sharpen(img_bgr):
    blurred = cv2.GaussianBlur(img_bgr, (0, 0), 3)
    return cv2.addWeighted(img_bgr, 1.5, blurred, -0.5, 0)


def _preprocess(img_bgr):
    return _apply_sharpen(_apply_clahe(img_bgr))


def _iou(b1, b2):
    ix1, iy1 = max(b1[0], b2[0]), max(b1[1], b2[1])
    ix2, iy2 = min(b1[2], b2[2]), min(b1[3], b2[3])
    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    a1 = (b1[2] - b1[0]) * (b1[3] - b1[1])
    a2 = (b2[2] - b2[0]) * (b2[3] - b2[1])
    return inter / (a1 + a2 - inter + 1e-6)


def _sahi_predict(model, frame, conf=0.15, iou=0.45):
    """Tiled inference. Returns merged detections in full-frame coordinates."""
    h, w = frame.shape[:2]
    if w <= SAHI_TILE_SIZE and h <= SAHI_TILE_SIZE:
        # Frame smaller than tile — plain predict
        boxes_by_cls = defaultdict(list)
        for r in model.predict(frame, imgsz=640, conf=conf, iou=iou, verbose=False):
            for box in r.boxes:
                cls = model.names[int(box.cls)]
                if cls == "manhole covers":
                    continue
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                boxes_by_cls[cls].append((float(box.conf), x1, y1, x2, y2))
        return _nms_by_cls(boxes_by_cls, iou)

    step = int(SAHI_TILE_SIZE * (1 - SAHI_OVERLAP))
    xs = list(range(0, w - SAHI_TILE_SIZE + 1, step))
    if not xs or xs[-1] + SAHI_TILE_SIZE < w:
        xs.append(max(0, w - SAHI_TILE_SIZE))
    ys = list(range(0, h - SAHI_TILE_SIZE + 1, step))
    if not ys or ys[-1] + SAHI_TILE_SIZE < h:
        ys.append(max(0, h - SAHI_TILE_SIZE))

    boxes_by_cls = defaultdict(list)
    for ty in ys:
        for tx in xs:
            tile = frame[ty:ty + SAHI_TILE_SIZE, tx:tx + SAHI_TILE_SIZE]
            for r in model.predict(tile, imgsz=640, conf=conf, iou=iou, verbose=False):
                for box in r.boxes:
                    cls = model.names[int(box.cls)]
                    if cls == "manhole covers":
                        continue
                    bx1, by1, bx2, by2 = map(int, box.xyxy[0].tolist())
                    boxes_by_cls[cls].append((float(box.conf), tx + bx1, ty + by1, tx + bx2, ty + by2))

    return _nms_by_cls(boxes_by_cls, iou)


def _nms_by_cls(boxes_by_cls, iou_thresh):
    result = []
    for cls, boxes in boxes_by_cls.items():
        boxes = sorted(boxes, key=lambda b: b[0], reverse=True)
        kept = []
        while boxes:
            best = boxes.pop(0)
            kept.append(best)
            boxes = [b for b in boxes if _iou(best[1:], b[1:]) < iou_thresh]
        for conf, x1, y1, x2, y2 in kept:
            result.append({"cls": cls, "conf": round(conf, 2), "box": [x1, y1, x2, y2]})
    return result


def _crop_box(img_bgr, box_xyxy) -> bytes | None:
    x1, y1, x2, y2 = box_xyxy
    h, w = img_bgr.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)
    crop = img_bgr[y1:y2, x1:x2]
    if crop.size == 0:
        return None
    _, buf = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return buf.tobytes()


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


def _crop_bytes(img_bgr, box) -> bytes | None:
    x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
    h, w = img_bgr.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)
    crop = img_bgr[y1:y2, x1:x2]
    if crop.size == 0:
        return None
    _, buf = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return buf.tobytes()


def _infer_image(filepath: str) -> tuple[list[dict], str | None]:
    model = _load_model()
    img_bgr = cv2.imread(filepath)
    infer_src = _preprocess(img_bgr) if img_bgr is not None else filepath
    results = model.predict(infer_src, imgsz=896, conf=0.15, iou=0.45, verbose=False)
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
                "crop_bytes": _crop_bytes(img_bgr, box) if img_bgr is not None else None,
            })
    return detections, annotated_url


def _extract_video_gps(filepath: str) -> tuple[float, float] | None:
    import re
    try:
        r = subprocess.run(
            ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', filepath],
            capture_output=True, text=True, timeout=30,
        )
        if r.returncode != 0:
            return None
        tags = json.loads(r.stdout).get('format', {}).get('tags', {})
        location = (
            tags.get('com.apple.quicktime.location.ISO6709') or
            tags.get('location') or
            tags.get('location-eng')
        )
        if not location:
            return None
        m = re.match(r'([+-]\d+\.?\d*)([+-]\d+\.?\d*)', location)
        if m:
            return float(m.group(1)), float(m.group(2))
    except Exception:
        pass
    return None


def _transcode_h264(src_path: str) -> str:
    dst_path = src_path.replace('.mp4', '_web.mp4')
    try:
        r = subprocess.run(
            ['ffmpeg', '-i', src_path,
             '-vcodec', 'libx264', '-preset', 'fast', '-crf', '23',
             '-movflags', '+faststart', '-y', dst_path],
            capture_output=True, timeout=300,
        )
        if r.returncode == 0:
            os.remove(src_path)
            return dst_path
    except Exception:
        pass
    return src_path


def _infer_video(filepath: str) -> tuple[list[dict], str | None]:
    model = _load_model()
    cap = cv2.VideoCapture(filepath)
    if not cap.isOpened():
        return [], None

    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    max_frames = int(fps * 60)  # cap at 60 seconds

    os.makedirs(settings.upload_dir, exist_ok=True)
    out_filename = f"vid_{uuid.uuid4().hex[:8]}.mp4"
    out_path = os.path.join(settings.upload_dir, out_filename)
    writer = cv2.VideoWriter(out_path, cv2.VideoWriter_fourcc(*'mp4v'), fps, (width, height))

    best_by_track: dict[int, dict] = {}
    best_by_class: dict[str, dict] = {}
    frame_idx = 0

    while cap.isOpened() and frame_idx < max_frames:
        ret, frame = cap.read()
        if not ret:
            break

        # Blur filter — write frame as-is, skip inference
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if cv2.Laplacian(gray, cv2.CV_64F).var() < BLUR_THRESHOLD:
            writer.write(frame)
            frame_idx += 1
            continue

        infer_frame = _preprocess(frame)

        results = model.track(
            infer_frame, imgsz=640, conf=0.15, iou=0.45,
            verbose=False, tracker="bytetrack.yaml", persist=True,
        )
        for r in results:
            r.names = {i: RUSSIAN_NAMES.get(n, n) for i, n in model.names.items()}
            if r.boxes is not None and len(r.boxes):
                keep = [i for i, b in enumerate(r.boxes) if model.names[int(b.cls)] != "manhole covers"]
                r = r[keep]
            writer.write(r.plot())
            for box in r.boxes:
                cls = model.names[int(box.cls)]
                if cls == "manhole covers":
                    continue
                conf = round(float(box.conf), 2)
                crop = _crop_bytes(frame, box)
                track_id = int(box.id.item()) if box.id is not None else None
                if track_id is not None:
                    if best_by_track.get(track_id, {}).get("conf", 0) < conf:
                        best_by_track[track_id] = {"cls": cls, "conf": conf, "crop_bytes": crop}
                else:
                    if best_by_class.get(cls, {}).get("conf", 0) < conf:
                        best_by_class[cls] = {"conf": conf, "crop_bytes": crop}

        # SAHI pass — catches small/distant defects missed by full-frame track
        if frame_idx % SAHI_INTERVAL == 0:
            for det in _sahi_predict(model, infer_frame, conf=0.15, iou=0.45):
                cls, conf = det["cls"], det["conf"]
                if best_by_class.get(cls, {}).get("conf", 0) < conf:
                    best_by_class[cls] = {
                        "conf": conf,
                        "crop_bytes": _crop_box(frame, det["box"]),
                    }

        frame_idx += 1

    cap.release()
    writer.release()
    out_path = _transcode_h264(out_path)
    out_filename = os.path.basename(out_path)

    # All unique tracks — one detection per track ID (Option B)
    detections = [
        {
            "defect_type": td["cls"],
            "severity": SEVERITY_MAP.get(td["cls"], "medium"),
            "confidence": td["conf"],
            "crop_bytes": td.get("crop_bytes"),
        }
        for td in best_by_track.values()
    ]
    # Fallback: classes detected without a track ID, not already covered
    tracked_classes = {td["cls"] for td in best_by_track.values()}
    for cls, d in best_by_class.items():
        if cls not in tracked_classes:
            detections.append({
                "defect_type": cls,
                "severity": SEVERITY_MAP.get(cls, "medium"),
                "confidence": d["conf"],
                "crop_bytes": d.get("crop_bytes"),
            })
    return detections, f"/uploads/{out_filename}"



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

        if lat and lng and not address:
            address = await loop.run_in_executor(None, _reverse_geocode, lat, lng)

        detections = []
        for det in raw:
            defect = Defect(
                defect_type=det["defect_type"],
                severity=det["severity"],
                confidence=det["confidence"],
                lat=lat,
                lng=lng,
                address=address,
                source_type="image",
                crop_image=det.get("crop_bytes"),
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
