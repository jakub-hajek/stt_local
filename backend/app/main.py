"""FastAPI application entry point for STT Local backend."""

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_model_repo, settings
from app.engine.factory import TranscriptionEngine
from app.routes import health, upload, websocket


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

    model_repo = get_model_repo(settings.model_size)
    logger.info("Using model repo: %s", model_repo)

    engine = TranscriptionEngine.get_instance()
    engine.load(model_repo=model_repo, language=settings.language)
    logger.info("STT Local backend is ready")

    yield  # Application runs here

    logger.info("STT Local backend shutting down")


app = FastAPI(
    title="STT Local",
    description="Local Speech-to-Text backend using mlx-whisper",
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
app.include_router(upload.router)
app.include_router(websocket.router)
