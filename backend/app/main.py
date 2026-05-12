from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.v1.api import api_router
from app.core.database import SessionLocal
from app.core.config import settings

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    # CORS spec forbids wildcard origins when credentials are enabled.
    # Keep credentials enabled only for explicit origin lists.
    allow_credentials="*" not in settings.BACKEND_CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {"message": "SelfMind Pro API is running"}


@app.get("/health", status_code=status.HTTP_200_OK)
def health():
    return {"status": "ok"}


@app.get("/health/db", status_code=status.HTTP_200_OK)
def database_health():
    try:
        with SessionLocal() as db:
            db.execute(text("select 1"))
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "error", "database": "unavailable"},
        )

    return {"status": "ok", "database": "available"}
