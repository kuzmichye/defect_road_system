"""
Модели прогнозирования рисков дорожных дефектов.

Параметры модели основаны на:
  [1] ASTM D6433-16. Standard Practice for Roads and Parking Lots Pavement
      Condition Index Surveys. — Кривые deduct value по типам дефектов.
  [2] ГОСТ Р 50597-2017. Дороги автомобильные и улицы. Требования к
      эксплуатационному состоянию. — Нормативные сроки устранения дефектов.
  [3] ERA5 reanalysis (Hersbach et al., 2020) через Open-Meteo Archive API —
      реальные суточные температуры Москвы 2021–2023 гг. для расчёта
      циклов замерзания-оттаивания (см. ml/fetch_weather.py).
"""
import os
import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
import joblib

# ─── Параметры типов дефектов ────────────────────────────────────────────────
# base_risk   — базовый индекс риска (0–100), откалиброван по max deduct value
#               методики PCI (ASTM D6433-16, таблицы Appendix X1).
# progression — относительная скорость прогрессии (0–1).
# base_days   — базовое время до критического состояния (дни).
#               ГОСТ Р 50597-2017: критичные → 5–10 сут, плановые → 30–60 сут.
DEFECT_PARAMS: dict[str, dict] = {
    'potholes':                  {'base_risk': 82, 'progression': 0.90, 'base_days': 45},
    'alligator cracks':          {'base_risk': 74, 'progression': 0.70, 'base_days': 80},
    'longitudnal_cracks':        {'base_risk': 44, 'progression': 0.38, 'base_days': 155},
    'transverse cracks':         {'base_risk': 54, 'progression': 0.48, 'base_days': 120},
    'rutting':                   {'base_risk': 60, 'progression': 0.50, 'base_days': 100},
    'patchy road sections':      {'base_risk': 33, 'progression': 0.28, 'base_days': 200},
    'lane line blurs':           {'base_risk': 18, 'progression': 0.18, 'base_days': 310},
    'pedestrian crossing blurs': {'base_risk': 23, 'progression': 0.20, 'base_days': 270},
    'repaired cracks':           {'base_risk': 28, 'progression': 0.22, 'base_days': 190},
}

SEVERITY_NUM: dict[str, int] = {'low': 1, 'medium': 2, 'high': 3}
RISK_LABELS:  list[str]       = ['low', 'medium', 'high', 'critical']

_DEFAULT_PARAMS = {'base_risk': 40, 'progression': 0.40, 'base_days': 150}

# Загружается при первом обращении из реальных данных ERA5
_SEASONAL_RISK: dict[int, float] | None = None


def get_seasonal_risk() -> dict[int, float]:
    global _SEASONAL_RISK
    if _SEASONAL_RISK is None:
        from ml.fetch_weather import get_seasonal_factors
        _SEASONAL_RISK = get_seasonal_factors()
    return _SEASONAL_RISK


def make_features(
    defect_type:  str,
    severity_num: int,
    age_days:     int,
    month:        int,
    confidence:   float,
) -> list[float]:
    p  = DEFECT_PARAMS.get(defect_type, _DEFAULT_PARAMS)
    sr = get_seasonal_risk()[month]
    return [
        float(p['base_risk']),
        float(p['progression']),
        float(severity_num),
        float(min(age_days, 365)),
        float(month),
        float(sr),
        float(confidence),
    ]


def _generate_data(n: int = 8000, seed: int = 42) -> tuple:
    rng    = np.random.default_rng(seed)
    types  = list(DEFECT_PARAMS.keys())
    sr_map = get_seasonal_risk()

    X, y_level, y_score, y_days = [], [], [], []

    for _ in range(n):
        dtype  = rng.choice(types)
        p      = DEFECT_PARAMS[dtype]
        sev_s  = rng.choice(['low', 'medium', 'high'], p=[0.30, 0.45, 0.25])
        sev    = SEVERITY_NUM[sev_s]
        age    = int(rng.integers(1, 366))
        month  = int(rng.integers(1, 13))
        conf   = float(rng.uniform(0.45, 1.0))
        sr     = sr_map[month]

        score = (
            p['base_risk']
            + min(age / 180.0, 1.0) * 18.0
            + (sev - 1) * 14.0
            + (sr - 1.0) * 9.0
            + float(rng.normal(0, 4.5))
        )
        score = float(np.clip(score, 0.0, 100.0))

        if score >= 80:   level = 3
        elif score >= 60: level = 2
        elif score >= 40: level = 1
        else:             level = 0

        days = float(np.clip(
            p['base_days'] - (sev - 1) * 18.0 - (sr - 1.0) * 12.0
            + float(rng.normal(0, 10)),
            7.0, 365.0,
        ))

        X.append(make_features(dtype, sev, age, month, conf))
        y_level.append(level)
        y_score.append(score)
        y_days.append(days)

    return np.array(X), np.array(y_level), np.array(y_score), np.array(y_days)


def train(models_dir: str) -> tuple:
    os.makedirs(models_dir, exist_ok=True)
    X, y_level, y_score, y_days = _generate_data()

    clf = RandomForestClassifier(
        n_estimators=200, max_depth=12, random_state=42, n_jobs=-1,
    )
    clf.fit(X, y_level)

    reg_score = GradientBoostingRegressor(n_estimators=150, max_depth=5, random_state=42)
    reg_score.fit(X, y_score)

    reg_days = GradientBoostingRegressor(n_estimators=150, max_depth=5, random_state=42)
    reg_days.fit(X, y_days)

    joblib.dump(clf,       os.path.join(models_dir, 'risk_clf.pkl'))
    joblib.dump(reg_score, os.path.join(models_dir, 'risk_score.pkl'))
    joblib.dump(reg_days,  os.path.join(models_dir, 'days_pred.pkl'))

    return clf, reg_score, reg_days


def evaluate(verbose: bool = True) -> dict:
    from sklearn.model_selection import cross_validate, StratifiedKFold, KFold
    from sklearn.metrics import make_scorer, mean_absolute_error, mean_squared_error

    X, y_level, y_score, y_days = _generate_data()

    clf = RandomForestClassifier(n_estimators=200, max_depth=12, random_state=42, n_jobs=-1)
    cv_clf = cross_validate(
        clf, X, y_level,
        cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=42),
        scoring=['accuracy', 'f1_macro'],
        return_train_score=False,
    )

    reg_s = GradientBoostingRegressor(n_estimators=150, max_depth=5, random_state=42)
    cv_score = cross_validate(
        reg_s, X, y_score,
        cv=KFold(n_splits=5, shuffle=True, random_state=42),
        scoring={
            'mae':  make_scorer(mean_absolute_error, greater_is_better=False),
            'rmse': make_scorer(lambda y, p: mean_squared_error(y, p) ** 0.5, greater_is_better=False),
            'r2':   'r2',
        },
        return_train_score=False,
    )

    reg_d = GradientBoostingRegressor(n_estimators=150, max_depth=5, random_state=42)
    cv_days = cross_validate(
        reg_d, X, y_days,
        cv=KFold(n_splits=5, shuffle=True, random_state=42),
        scoring={
            'mae':  make_scorer(mean_absolute_error, greater_is_better=False),
            'rmse': make_scorer(lambda y, p: mean_squared_error(y, p) ** 0.5, greater_is_better=False),
            'r2':   'r2',
        },
        return_train_score=False,
    )

    results = {
        'classifier': {
            'accuracy': float(np.mean(cv_clf['test_accuracy'])),
            'f1_macro': float(np.mean(cv_clf['test_f1_macro'])),
        },
        'risk_score_regressor': {
            'mae':  float(-np.mean(cv_score['test_mae'])),
            'rmse': float(-np.mean(cv_score['test_rmse'])),
            'r2':   float(np.mean(cv_score['test_r2'])),
        },
        'days_regressor': {
            'mae':  float(-np.mean(cv_days['test_mae'])),
            'rmse': float(-np.mean(cv_days['test_rmse'])),
            'r2':   float(np.mean(cv_days['test_r2'])),
        },
    }

    if verbose:
        print("\n=== Метрики (5-fold CV, n=8000) ===")
        print(f"\nRandomForestClassifier (уровень риска):")
        print(f"  Accuracy : {results['classifier']['accuracy']:.3f}")
        print(f"  F1 macro : {results['classifier']['f1_macro']:.3f}")
        print(f"\nGradientBoosting (risk score 0–100):")
        print(f"  MAE  : {results['risk_score_regressor']['mae']:.2f}")
        print(f"  RMSE : {results['risk_score_regressor']['rmse']:.2f}")
        print(f"  R2   : {results['risk_score_regressor']['r2']:.3f}")
        print(f"\nGradientBoosting (dней до критичного):")
        print(f"  MAE  : {results['days_regressor']['mae']:.2f}")
        print(f"  RMSE : {results['days_regressor']['rmse']:.2f}")
        print(f"  R2   : {results['days_regressor']['r2']:.3f}")

    return results
