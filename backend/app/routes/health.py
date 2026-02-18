"""Health-check endpoint."""

from fastapi import APIRouter

from app.engine.factory import TranscriptionEngine

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    """Return service health and configuration information."""
    engine = TranscriptionEngine.get_instance()
    return {
        "status": "ok" if engine.is_loaded else "loading",
        "backend": engine.backend,
        "device": engine.device,
        "model": engine.model_size,
        "version": "0.1.0",
    }
