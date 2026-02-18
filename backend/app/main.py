"""FastAPI application entry point for STT Local backend."""

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.engine.detector import detect_backend
from app.engine.factory import TranscriptionEngine
from app.routes import health, websocket


def _setup_logging() -> None:
    """Configure root logging based on application settings."""
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan: load the transcription model at startup."""
    _setup_logging()
    logger = logging.getLogger(__name__)

    backend, device = detect_backend()
    logger.info("Detected backend=%s, device=%s", backend, device)

    engine = TranscriptionEngine.get_instance()
    engine.load(
        model_size=settings.model_size,
        language=settings.language,
        backend=backend,
        device=device,
    )
    logger.info("STT Local backend is ready")

    yield  # Application runs here

    logger.info("STT Local backend shutting down")


app = FastAPI(
    title="STT Local",
    description="Local Speech-to-Text backend using SimulStreaming (UFAL)",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router)
app.include_router(websocket.router)
