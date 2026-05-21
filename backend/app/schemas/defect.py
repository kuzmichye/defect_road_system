from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class DefectBase(BaseModel):
    defect_type: str
    severity: str = "medium"
    confidence: Optional[float] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    address: Optional[str] = None
    source_type: str = "image"


class DefectCreate(DefectBase):
    pass


class DefectUpdate(BaseModel):
    defect_type: Optional[str] = None
    severity: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    address: Optional[str] = None


class DefectOut(DefectBase):
    id: int
    detected_at: datetime
    has_crop: bool = False

    class Config:
        from_attributes = True
