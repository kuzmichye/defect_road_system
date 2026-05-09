from fastapi import APIRouter, UploadFile, File, Form, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from app.database import get_db
from app.services.detection import DetectionService
from app.schemas.defect import DefectOut
from app.services.auth import get_current_user
from app.tasks import process_video_task
from app.celery_app import celery_app
from celery.result import AsyncResult

router = APIRouter(dependencies=[Depends(get_current_user)])
detection_service = DetectionService()


@router.post("/image", response_model=List[DefectOut])
async def detect_from_image(
    file: UploadFile = File(...),
    lat: Optional[float] = Form(None),
    lng: Optional[float] = Form(None),
    address: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    return await detection_service.process_image(file, lat, lng, address, db)


@router.post("/video")
async def detect_from_video(
    file: UploadFile = File(...),
    lat: Optional[float] = Form(None),
    lng: Optional[float] = Form(None),
    address: Optional[str] = Form(None),
):
    filepath = await detection_service._save_file(file)
    task = process_video_task.delay(filepath, lat, lng, address)
    return {"task_id": task.id, "status": "processing"}


@router.get("/video/status/{task_id}")
async def video_task_status(task_id: str):
    result = AsyncResult(task_id, app=celery_app)
    if result.state == "SUCCESS":
        return {"status": "done", **result.result}
    if result.state == "FAILURE":
        return {"status": "error", "message": "Ошибка при обработке видео"}
    return {"status": "processing"}
