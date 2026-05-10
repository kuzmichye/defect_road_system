from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from prometheus_fastapi_instrumentator import Instrumentator
import os
from app.routers import detection, inventory, export, auth, analytics

os.makedirs("uploads", exist_ok=True)

app = FastAPI(title="Road Defect Detection API", version="1.0.0")

Instrumentator().instrument(app).expose(app, endpoint="/metrics")

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

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(detection.router, prefix="/api/detection", tags=["detection"])
app.include_router(inventory.router, prefix="/api/inventory", tags=["inventory"])
app.include_router(export.router, prefix="/api/export", tags=["export"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])


@app.get("/")
def root():
    return {"status": "ok", "message": "Road Defect API is running"}
