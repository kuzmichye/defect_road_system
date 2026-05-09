from app.celery_app import celery_app
from app.services.detection import _infer_video
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
    raw, frame_urls = _infer_video(filepath)
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
            ))
        db.commit()
    count = len(raw)
    return {
        "count": count,
        "message": f"Видео обработано, обнаружено дефектов: {count}",
        "frame_urls": frame_urls,
    }
