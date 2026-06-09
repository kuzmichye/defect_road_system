# RoadInspect: система мониторинга дефектов дорожного покрытия

Веб-платформа для автоматического выявления дефектов дорожного покрытия (выбоины, трещины, колейность, износ разметки и др.) на фото и видео с помощью YOLO, ведения реестра дефектов на карте и прогнозирования рисков их развития.

Проект разработан в рамках выпускной квалификационной работы (НИУ МГСУ).

[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![YOLO](https://img.shields.io/badge/Ultralytics-YOLO-00FFFF?logo=yolo&logoColor=black)](https://github.com/ultralytics/ultralytics)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

## Содержание

- [О проекте](#о-проекте)
- [Возможности](#возможности)
- [Архитектура](#архитектура)
- [Технологический стек](#технологический-стек)
- [Структура проекта](#структура-проекта)
- [Запуск проекта](#запуск-проекта)
- [Мониторинг](#мониторинг)

## О проекте

RoadInspect автоматизирует процесс инвентаризации дефектов дорожного покрытия. Оператор загружает фото или видео объезда дороги, система детектирует дефекты с помощью обученной модели YOLO, привязывает их к геолокации (GPS из EXIF или ручной ввод), сохраняет в базу данных и отображает на интерактивной карте. Дополнительный ML-модуль оценивает приоритет ремонта на основе типа, тяжести и сезонных факторов риска.

## Возможности

- Детекция дефектов на фото и видео: модель YOLO с препроцессингом кадров (CLAHE, sharpening), фильтрацией размытых кадров и тайловым SAHI-инференсом для мелких объектов
- Асинхронная обработка видео: длительные задачи выполняются в фоне через Celery и Redis с отслеживанием статуса
- Геолокация дефектов: извлечение GPS-координат из EXIF или ручной ввод, обратное геокодирование адреса
- Интерактивная карта с кластеризацией дефектов (Leaflet), фильтрацией по типу и тяжести
- Реестр (инвентаризация) дефектов: таблица всех найденных дефектов с фото, статусами и характеристиками
- Аналитика и прогноз: динамика появления дефектов, прогноз на 14 дней (линейная регрессия), топ типов дефектов
- ML-оценка риска: модель прогнозирует уровень риска, рейтинг приоритета и количество дней до критического состояния дефекта с учётом сезонности
- Экспорт данных в CSV и GeoJSON
- JWT-аутентификация пользователей
- Мониторинг через метрики Prometheus и дашборды Grafana

## Архитектура

```
React + TypeScript  <---->  FastAPI backend  <---->  PostgreSQL
                                  |
                  +---------------+---------------+
                  |               |               |
            YOLO model        Celery + Redis   ML risk
            (detection)        (video tasks)   predictor
                  |
            Prometheus  ----------------------->  Grafana
```

Подробная схема: [architecture.drawio](architecture.drawio) (открывается в [draw.io](https://app.diagrams.net/)).

## Технологический стек

Backend:
- FastAPI, SQLAlchemy 2.0 (async), asyncpg, Alembic
- Ultralytics YOLO + OpenCV (детекция дефектов, SAHI-инференс)
- Celery + Redis (фоновая обработка видео)
- scikit-learn (прогнозирование риска дефектов)
- JWT-аутентификация (python-jose, passlib)

Frontend:
- React 18, TypeScript, Vite
- Tailwind CSS
- Leaflet / react-leaflet (карта, кластеризация)
- Recharts (графики аналитики)
- Zustand (состояние), Axios

Инфраструктура:
- Docker Compose (backend, frontend, PostgreSQL, Redis, Celery worker)
- Prometheus и Grafana (метрики и дашборды)

## Структура проекта

```
backend/
  app/
    routers/        API: auth, detection, inventory, export, analytics
    services/        бизнес-логика (детекция, аутентификация)
    models/           SQLAlchemy-модели
    schemas/          Pydantic-схемы
    tasks.py          Celery-задачи (обработка видео)
    main.py           точка входа FastAPI
  ml/                  обучение и инференс модели риска
  alembic/             миграции БД

frontend/
  src/
    pages/             Дашборд, Загрузка, Карта, Инвентаризация, Аналитика
    components/        UI-компоненты (карта, сайдбар, карточки)
    store/             Zustand-сторы

monitoring/            конфигурация Prometheus и Grafana
```

## Запуск проекта

Требования: Docker и Docker Compose.

1. Склонируйте репозиторий:
   ```bash
   git clone <repo-url>
   cd defect_road_web
   ```

2. Создайте `.env`-файл из примера:
   ```bash
   cp backend/.env.example backend/.env
   ```

3. Поместите обученные веса YOLO в `backend/models/best.pt`.

4. Запустите все сервисы:
   ```bash
   docker compose up --build
   ```

5. Откройте приложение:
   - Frontend: http://localhost:5173
   - API-документация (Swagger): http://localhost:8000/api/docs

## Мониторинг

После запуска `docker compose` доступны:
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000 (логин: `admin`)

Дашборд с метриками детекции дефектов и обработки видео подключён через provisioning (`monitoring/grafana/dashboards`).

---

Дипломный проект, НИУ МГСУ
