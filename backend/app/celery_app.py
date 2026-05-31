from celery import Celery
from celery.signals import worker_ready
from app.config import settings

celery_app = Celery(
    "defect_road",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks"],
)
celery_app.conf.task_serializer = "json"
celery_app.conf.result_serializer = "json"
celery_app.conf.accept_content = ["json"]
celery_app.conf.result_expires = 3600


@worker_ready.connect
def warmup_model(sender, **kwargs):
    import numpy as np
    from app.services.detection import _load_model
    model = _load_model()
    model.predict(np.zeros((640, 640, 3), dtype=np.uint8), imgsz=640, verbose=False)
