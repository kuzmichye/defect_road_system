import os
import numpy as np
import joblib

from ml.train import (
    DEFECT_PARAMS, SEVERITY_NUM, RISK_LABELS,
    make_features, train, get_seasonal_risk,
)

_MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')
_cache: dict = {}


def _ensure_loaded() -> None:
    if _cache:
        return
    clf_path = os.path.join(_MODELS_DIR, 'risk_clf.pkl')
    if not os.path.exists(clf_path):
        train(_MODELS_DIR)
    _cache['clf']   = joblib.load(os.path.join(_MODELS_DIR, 'risk_clf.pkl'))
    _cache['score'] = joblib.load(os.path.join(_MODELS_DIR, 'risk_score.pkl'))
    _cache['days']  = joblib.load(os.path.join(_MODELS_DIR, 'days_pred.pkl'))


def predict_risk(
    defect_type: str,
    severity: str,
    confidence: float,
    detected_at,
) -> dict:
    from datetime import date

    _ensure_loaded()

    today = date.today()
    d = detected_at.date() if hasattr(detected_at, 'date') else detected_at
    age = max(0, (today - d).days)
    month = today.month
    sev = SEVERITY_NUM.get(severity, 2)

    feat = np.array([make_features(defect_type, sev, age, month, confidence or 0.7)])

    level_idx = int(_cache['clf'].predict(feat)[0])
    score     = float(np.clip(_cache['score'].predict(feat)[0], 0.0, 100.0))
    days      = float(np.clip(_cache['days'].predict(feat)[0],  7.0, 365.0))

    return {
        'risk_score':       round(score, 1),
        'risk_level':       RISK_LABELS[level_idx],
        'days_to_critical': int(days),
        'season_factor':    get_seasonal_risk()[month],
    }


def preload() -> None:
    _ensure_loaded()
