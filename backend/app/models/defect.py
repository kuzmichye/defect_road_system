from sqlalchemy import Column, Integer, String, Float, DateTime, Text, LargeBinary
from sqlalchemy.sql import func
from app.database import Base


class Defect(Base):
    __tablename__ = "defects"

    id = Column(Integer, primary_key=True, index=True)
    defect_type = Column(String, nullable=False)
    severity = Column(String, default="medium")
    confidence = Column(Float, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    address = Column(String, nullable=True)
    source_type = Column(String, default="image")
    description = Column(Text, nullable=True)
    detected_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    crop_image = Column(LargeBinary, nullable=True)

    @property
    def has_crop(self) -> bool:
        return self.crop_image is not None
