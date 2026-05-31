from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST, CollectorRegistry, multiprocess as prom_multiprocess
import os
from app.routers import detection, inventory, export, auth, analytics
from app.services.auth import get_current_user

os.makedirs("uploads", exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _preload_ml)
    yield


def _preload_ml():
    try:
        from ml.predictor import preload
        preload()
    except Exception:
        pass  # не блокировать старт если sklearn не установлен


app = FastAPI(
    title="Road Defect Detection API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

Instrumentator().instrument(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://roadinspect.ru",
        "https://www.roadinspect.ru",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _collect_metrics() -> bytes:
    if 'PROMETHEUS_MULTIPROC_DIR' in os.environ:
        registry = CollectorRegistry()
        prom_multiprocess.MultiProcessCollector(registry)
        return generate_latest(registry)
    return generate_latest()


# /metrics — только для авторизованных пользователей (публичный доступ)
@app.get("/metrics", include_in_schema=False)
async def metrics(_user=Depends(get_current_user)):
    return Response(_collect_metrics(), media_type=CONTENT_TYPE_LATEST)


# /internal/metrics — для Prometheus внутри Docker-сети (без токена, не экспонируется наружу)
@app.get("/internal/metrics", include_in_schema=False)
async def metrics_internal():
    return Response(_collect_metrics(), media_type=CONTENT_TYPE_LATEST)


app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(detection.router, prefix="/api/detection", tags=["detection"])
app.include_router(inventory.router, prefix="/api/inventory", tags=["inventory"])
app.include_router(export.router, prefix="/api/export", tags=["export"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])


@app.get("/")
def root():
    return {"status": "ok", "message": "Road Defect API is running"}
