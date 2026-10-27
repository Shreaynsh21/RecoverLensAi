from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session

from app.config import settings
from app.db import get_session


# Create the FastAPI application.
app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
)

# Allow requests from the local Vite frontend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/health")
def health():
    """Check whether the API is running."""
    return {"status": "ok"}


@app.get("/ready")
def ready(session: Session = Depends(get_session)):
    """Check whether the API can execute a query against MySQL."""
    try:
        result = session.execute(text("SELECT 1")).scalar_one()
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail="Database is unavailable",
        ) from exc

    return {
        "status": "ready",
        "database": "connected",
        "probe": result,
    }