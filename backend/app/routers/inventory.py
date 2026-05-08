from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional, List
from app.database import get_db
from app.models.defect import Defect
from app.schemas.defect import DefectOut, DefectUpdate
from app.services.auth import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/defects", response_model=List[DefectOut])
async def get_defects(
    skip: int = 0,
    limit: int = 200,
    defect_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    q = select(Defect).order_by(Defect.detected_at.desc()).offset(skip).limit(limit)
    if defect_type:
        q = q.where(Defect.defect_type == defect_type)
    if severity:
        q = q.where(Defect.severity == severity)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/defects/{defect_id}", response_model=DefectOut)
async def get_defect(defect_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Defect).where(Defect.id == defect_id))
    defect = result.scalar_one_or_none()
    if not defect:
        raise HTTPException(status_code=404, detail="Defect not found")
    return defect


@router.put("/defects/{defect_id}", response_model=DefectOut)
async def update_defect(defect_id: int, update: DefectUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Defect).where(Defect.id == defect_id))
    defect = result.scalar_one_or_none()
    if not defect:
        raise HTTPException(status_code=404, detail="Defect not found")
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(defect, key, value)
    await db.commit()
    await db.refresh(defect)
    return defect


@router.delete("/defects/{defect_id}")
async def delete_defect(defect_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Defect).where(Defect.id == defect_id))
    defect = result.scalar_one_or_none()
    if not defect:
        raise HTTPException(status_code=404, detail="Defect not found")
    await db.delete(defect)
    await db.commit()
    return {"message": "Deleted"}


@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Defect))
    all_defects = result.scalars().all()
    by_type: dict = {}
    by_severity: dict = {}
    for d in all_defects:
        by_type[d.defect_type] = by_type.get(d.defect_type, 0) + 1
        by_severity[d.severity] = by_severity.get(d.severity, 0) + 1
    return {"total": len(all_defects), "by_type": by_type, "by_severity": by_severity}
