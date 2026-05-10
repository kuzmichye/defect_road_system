from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date, timedelta
from collections import defaultdict
from app.database import get_db
from app.models.defect import Defect
from app.services.auth import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/forecast")
async def get_forecast(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Defect.detected_at, Defect.defect_type))
    rows = result.all()

    today = date.today()
    counts_by_date: dict[date, int] = defaultdict(int)
    type_counts: dict[str, int] = defaultdict(int)

    for detected_at, defect_type in rows:
        if defect_type == "manhole covers":
            continue
        d = detected_at.date() if hasattr(detected_at, "date") else detected_at
        counts_by_date[d] += 1
        type_counts[defect_type] += 1

    history = [
        {"date": (today - timedelta(days=i)).isoformat(),
         "count": counts_by_date.get(today - timedelta(days=i), 0)}
        for i in range(29, -1, -1)
    ]

    n = len(history)
    xs = list(range(n))
    ys = [h["count"] for h in history]
    x_mean = sum(xs) / n
    y_mean = sum(ys) / n
    num = sum((xs[i] - x_mean) * (ys[i] - y_mean) for i in range(n))
    den = sum((xs[i] - x_mean) ** 2 for i in range(n))
    slope = num / den if den != 0 else 0
    intercept = y_mean - slope * x_mean

    forecast = [
        {"date": (today + timedelta(days=i)).isoformat(),
         "count": round(max(0.0, slope * (n - 1 + i) + intercept), 1)}
        for i in range(1, 15)
    ]

    top_types = sorted(type_counts.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "history": history,
        "forecast": forecast,
        "slope": round(slope, 3),
        "top_types": [{"type": t, "count": c} for t, c in top_types],
    }
