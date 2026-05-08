from fastapi import APIRouter, UploadFile, File, Form, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from app.database import get_db
from app.services.detection import DetectionService
from app.schemas.defect import DefectOut
from app.services.auth import get_current_user

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
    db: AsyncSession = Depends(get_db),
):
    return await detection_service.process_video(file, lat, lng, address, db)
