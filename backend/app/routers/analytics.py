from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date, timedelta
from collections import defaultdict
from app.database import get_db
from app.models.defect import Defect
from app.services.auth import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])

_RU_MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
               'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']


def _ru_month(m: int) -> str:
    return _RU_MONTHS[m - 1]


# ─── существующий эндпоинт ────────────────────────────────────────────────────

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


# ─── ML: сводка рисков по всем дефектам ──────────────────────────────────────

@router.get("/risk-summary")
async def get_risk_summary(db: AsyncSession = Depends(get_db)):
    from ml.predictor import predict_risk

    result = await db.execute(
        select(
            Defect.id, Defect.defect_type, Defect.severity,
            Defect.confidence, Defect.detected_at, Defect.address,
        )
    )
    rows = result.all()

    distribution: dict[str, int] = {'low': 0, 'medium': 0, 'high': 0, 'critical': 0}
    scores: list[float] = []
    ranked: list[dict] = []

    for row in rows:
        if row.defect_type == "manhole covers":
            continue
        pred = predict_risk(
            row.defect_type,
            row.severity or 'medium',
            row.confidence or 0.7,
            row.detected_at,
        )
        distribution[pred['risk_level']] += 1
        scores.append(pred['risk_score'])
        ranked.append({
            'id':               row.id,
            'defect_type':      row.defect_type,
            'severity':         row.severity,
            'address':          row.address,
            'risk_score':       pred['risk_score'],
            'risk_level':       pred['risk_level'],
            'days_to_critical': pred['days_to_critical'],
        })

    ranked.sort(key=lambda x: x['risk_score'], reverse=True)
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0

    return {
        'total':            len(scores),
        'distribution':     distribution,
        'avg_risk_score':   avg_score,
        'critical_defects': ranked[:10],
    }


# ─── ML: сезонный прогноз на 6 месяцев ───────────────────────────────────────

@router.get("/risk-forecast")
async def get_risk_forecast(db: AsyncSession = Depends(get_db)):
    from ml.train import get_seasonal_risk
    SEASONAL_RISK = get_seasonal_risk()

    result = await db.execute(select(Defect.defect_type, Defect.detected_at))
    rows = result.all()

    today = date.today()
    thirty_ago = today - timedelta(days=30)

    type_counts_30: dict[str, int] = defaultdict(int)
    for defect_type, detected_at in rows:
        if defect_type == "manhole covers":
            continue
        d = detected_at.date() if hasattr(detected_at, "date") else detected_at
        if d >= thirty_ago:
            type_counts_30[defect_type] += 1

    total_30 = sum(type_counts_30.values()) or 1
    daily_rate = total_30 / 30.0

    top_types = sorted(type_counts_30.items(), key=lambda x: x[1], reverse=True)[:5]

    months = []
    for i in range(1, 7):
        future = today + timedelta(days=30 * i)
        m = future.month
        sr = SEASONAL_RISK[m]
        predicted = max(0, round(daily_rate * 30 * sr))

        breakdown = {
            dtype: max(0, round(predicted * cnt / total_30))
            for dtype, cnt in top_types
        }

        months.append({
            'month':           future.strftime('%Y-%m'),
            'label':           _ru_month(m),
            'predicted_count': predicted,
            'season_factor':   round(sr, 2),
            'breakdown':       breakdown,
        })

    return {
        'months':             months,
        'current_daily_rate': round(daily_rate, 2),
    }
