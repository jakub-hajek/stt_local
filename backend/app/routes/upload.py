"""REST endpoint for file upload transcription."""

import asyncio
import io
import logging

import librosa
import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.engine.factory import TranscriptionEngine

logger = logging.getLogger(__name__)

router = APIRouter()

SAMPLE_RATE = 16000


def _decode_audio(raw_bytes: bytes) -> np.ndarray:
    """Decode and resample audio to 16kHz mono float32 (thread-safe)."""
    audio, _ = librosa.load(
        io.BytesIO(raw_bytes),
        sr=SAMPLE_RATE,
        mono=True,
    )
    return audio


def _segments_from_result(result: dict) -> list[dict]:
    """Extract segments with ms timing from an mlx_whisper result."""
    segments: list[dict] = []
    for seg in result.get("segments", []):
        segments.append({
            "text": seg["text"].strip(),
            "start_ms": round(seg["start"] * 1000),
            "end_ms": round(seg["end"] * 1000),
        })
    return segments


@router.post("/api/transcribe")
async def transcribe_file(
    file: UploadFile = File(...),
    language: str = Form("cs"),
):
    """Transcribe an uploaded audio file.

    Accepts WAV, MP3, FLAC, OGG, etc. via multipart upload.
    Returns full transcription with segments and timing.
    """
    engine = TranscriptionEngine.get_instance()
    if not engine.is_loaded:
        raise HTTPException(status_code=503, detail="Transcription engine not loaded")

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        audio = await asyncio.to_thread(_decode_audio, raw_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not decode audio file: {e}")

    duration_ms = len(audio) / SAMPLE_RATE * 1000

    try:
        result = await engine.transcribe_async(audio, language)
        segments = _segments_from_result(result)
    except Exception:
        logger.exception("Transcription failed")
        raise HTTPException(status_code=500, detail="Transcription failed")

    full_text = " ".join(seg["text"] for seg in segments).strip()

    return {
        "text": full_text,
        "segments": segments,
        "duration_ms": round(duration_ms, 1),
    }
