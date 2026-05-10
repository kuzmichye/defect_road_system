from app.celery_app import celery_app
from app.services.detection import _infer_video, _reverse_geocode, _extract_video_gps
from app.models.defect import Defect
from app.config import settings
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
    raw, annotated_video_url = _infer_video(filepath)
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
