from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.defect import Defect
from app.services.auth import get_current_user
import csv
import io

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/csv")
async def export_csv(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Defect).order_by(Defect.detected_at.desc()))
    defects = result.scalars().all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Тип", "Тяжесть", "Уверенность", "Широта", "Долгота", "Адрес", "Источник", "Дата"])
    for d in defects:
        writer.writerow([
            d.id, d.defect_type, d.severity,
            round(d.confidence, 3) if d.confidence else "",
            d.lat, d.lng, d.address or "",
            d.source_type, d.detected_at,
        ])
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=defects.csv"},
    )


@router.get("/geojson")
async def export_geojson(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Defect).where(Defect.lat.isnot(None), Defect.lng.isnot(None))
    )
    defects = result.scalars().all()
    features = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [d.lng, d.lat]},
            "properties": {
                "id": d.id,
                "type": d.defect_type,
                "severity": d.severity,
                "confidence": d.confidence,
                "address": d.address,
                "detected_at": str(d.detected_at),
            },
        }
        for d in defects
    ]
    return {"type": "FeatureCollection", "features": features}
