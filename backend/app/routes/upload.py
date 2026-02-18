"""REST endpoint for file upload transcription."""

import logging

import librosa
import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.engine.factory import TranscriptionEngine
from app.engine.processor import SessionProcessor

logger = logging.getLogger(__name__)

router = APIRouter()

SAMPLE_RATE = 16000
# For file upload we use large chunks (30s) to minimize decoding loop overhead.
# SimulStreaming runs a full decode per chunk, so tiny chunks are very slow.
CHUNK_SAMPLES = SAMPLE_RATE * 30  # 30 seconds at 16kHz


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

    # Read and decode audio
    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        audio, _ = librosa.load(
            __import__("io").BytesIO(raw_bytes),
            sr=SAMPLE_RATE,
            mono=True,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not decode audio file: {e}")

    duration_ms = len(audio) / SAMPLE_RATE * 1000

    # Create session and feed audio in chunks
    online_processor = engine.create_session()
    session = SessionProcessor(online_processor)

    segments = []
    for offset in range(0, len(audio), CHUNK_SAMPLES):
        chunk = audio[offset : offset + CHUNK_SAMPLES]
        results = session.feed_audio(chunk)
        for text, start_ms, end_ms in results:
            segments.append({"text": text, "start_ms": start_ms, "end_ms": end_ms})

    # Flush remaining
    finals = session.flush()
    for text, start_ms, end_ms in finals:
        segments.append({"text": text, "start_ms": start_ms, "end_ms": end_ms})

    full_text = " ".join(seg["text"] for seg in segments).strip()

    return {
        "text": full_text,
        "segments": segments,
        "duration_ms": round(duration_ms, 1),
    }
