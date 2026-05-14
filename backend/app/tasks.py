import time
from app.celery_app import celery_app
from app.services.detection import _infer_video, _reverse_geocode, _extract_video_gps
from app.models.defect import Defect
from app.config import settings
from app.metrics import defect_detections_total, detection_duration_seconds
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_sync_engine = create_engine(
    settings.database_url.replace("+asyncpg", "+psycopg2"),
    pool_pre_ping=True,
)
_SyncSession = sessionmaker(_sync_engine)


@celery_app.task
def process_video_task(filepath: str, lat, lng, address):
    if not lat or not lng:
        gps = _extract_video_gps(filepath)
        if gps:
            lat, lng = gps
    if lat and lng and not address:
        address = _reverse_geocode(lat, lng)
    t0 = time.perf_counter()
    raw, annotated_video_url = _infer_video(filepath)
    detection_duration_seconds.labels(source_type="video").observe(time.perf_counter() - t0)
    with _SyncSession() as db:
        for det in raw:
            db.add(Defect(
                defect_type=det["defect_type"],
                severity=det["severity"],
                confidence=det["confidence"],
                lat=lat,
                lng=lng,
                address=address,
                source_type="video",
                crop_image=det.get("crop_bytes"),
            ))
            defect_detections_total.labels(
                defect_type=det["defect_type"],
                severity=det["severity"],
                source_type="video",
            ).inc()
        db.commit()
    count = len(raw)
    return {
        "count": count,
        "message": f"Видео обработано, обнаружено дефектов: {count}",
        "annotated_video_url": annotated_video_url,
        "defects": [
            {"defect_type": d["defect_type"], "confidence": d["confidence"]}
            for d in raw
        ],
    }
