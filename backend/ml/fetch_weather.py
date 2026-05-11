"""
Загружает реальные исторические данные температуры по Москве
через Open-Meteo Archive API (бесплатно, без ключа, данные ERA5).

Источник: Hersbach et al. (2020) ERA5 global reanalysis.
Copernicus Climate Data Store. https://doi.org/10.24381/cds.adbb2d47

Метод: цикл замерзания-оттаивания (з/о) — день, в который
T_min < 0°C и T_max > 0°C. Это главная физическая причина
образования выбоин и трещин в асфальте (Chapman, 1994;
Rajab et al., 2013). Сезонный коэффициент = среднее кол-во
з/о циклов за месяц, нормированное к базовому (июнь = 1.0).
"""
import json
import os
import datetime
from urllib.request import urlopen
from urllib.parse import urlencode
from collections import defaultdict

CACHE_FILE = os.path.join(os.path.dirname(__file__), 'models', 'seasonal_factors.json')

_MOSCOW_LAT = 55.7558
_MOSCOW_LON = 37.6173
_BASE_LOAD   = 0.8   # фоновый износ от трафика (без з/о)


def _fetch(start_year: int = 2021, end_year: int = 2023) -> dict:
    params = urlencode({
        "latitude":   _MOSCOW_LAT,
        "longitude":  _MOSCOW_LON,
        "start_date": f"{start_year}-01-01",
        "end_date":   f"{end_year}-12-31",
        "daily":      "temperature_2m_max,temperature_2m_min",
        "timezone":   "Europe/Moscow",
    })
    url = f"https://archive-api.open-meteo.com/v1/archive?{params}"
    with urlopen(url, timeout=15) as resp:
        return json.loads(resp.read().decode())


def _compute(data: dict) -> dict[int, float]:
    dates     = data["daily"]["time"]
    max_temps = data["daily"]["temperature_2m_max"]
    min_temps = data["daily"]["temperature_2m_min"]

    # Считаем з/о циклы по (год, месяц)
    ym_cycles: dict[tuple, int] = defaultdict(int)
    for date_str, t_max, t_min in zip(dates, max_temps, min_temps):
        if t_max is None or t_min is None:
            continue
        d = datetime.date.fromisoformat(date_str)
        if t_min < 0.0 and t_max > 0.0:
            ym_cycles[(d.year, d.month)] += 1

    # Среднее по годам для каждого месяца
    by_month: dict[int, list[int]] = defaultdict(list)
    for (_, month), count in ym_cycles.items():
        by_month[month].append(count)
    avg = {m: sum(v) / len(v) for m, v in by_month.items()}
    for m in range(1, 13):
        avg.setdefault(m, 0.0)

    # Нормируем: июнь = 1.0
    june_raw = avg[6] + _BASE_LOAD
    return {m: round((avg[m] + _BASE_LOAD) / june_raw, 3) for m in range(1, 13)}


def _fallback() -> dict[int, float]:
    """Статический запасной вариант на случай недоступности сети."""
    return {
        1: 1.40, 2: 1.60, 3: 3.20, 4: 3.80, 5: 2.00,
        6: 1.00, 7: 0.80, 8: 0.85, 9: 1.10, 10: 1.50, 11: 1.90, 12: 1.40,
    }


def get_seasonal_factors(force_refresh: bool = False) -> dict[int, float]:
    """
    Возвращает сезонные коэффициенты риска для Москвы,
    рассчитанные из реальных данных ERA5 (Open-Meteo).
    Кэширует в models/seasonal_factors.json при первом вызове.
    """
    os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)

    if not force_refresh and os.path.exists(CACHE_FILE):
        with open(CACHE_FILE) as f:
            return {int(k): v for k, v in json.load(f).items()}

    try:
        data    = _fetch()
        factors = _compute(data)
        with open(CACHE_FILE, 'w') as f:
            json.dump(factors, f, indent=2)
        print(f"[weather] Загружены реальные данные ERA5. Коэффициенты: {factors}")
        return factors
    except Exception as exc:
        print(f"[weather] Open-Meteo недоступен ({exc}), используются статические значения.")
        return _fallback()
