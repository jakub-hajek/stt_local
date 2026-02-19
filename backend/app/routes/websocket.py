"""WebSocket endpoint for real-time transcription."""

import asyncio
import json
import logging

import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.audio.normalizer import pcm_to_float32
from app.engine.factory import TranscriptionEngine
from app.models import (
    ConnectedMessage,
    DoneMessage,
    FinalResult,
    PartialResult,
    ReadyMessage,
)

logger = logging.getLogger(__name__)

router = APIRouter()

SAMPLE_RATE = 16000
# Transcribe every 2 seconds of new audio
MIN_SAMPLES_FOR_TRANSCRIBE = SAMPLE_RATE * 2
# Force-finalize and reset buffer at 30 seconds
MAX_BUFFER_SAMPLES = SAMPLE_RATE * 30


async def _transcribe_and_send(
    ws: WebSocket,
    engine: TranscriptionEngine,
    audio: np.ndarray,
    language: str,
    msg_type: type[PartialResult] | type[FinalResult],
) -> None:
    """Run transcription off the event loop and send results over WebSocket."""
    result = await engine.transcribe_async(audio, language)
    for seg in result.get("segments", []):
        text = seg["text"].strip()
        if text:
            msg = msg_type(
                text=text,
                start_ms=round(seg["start"] * 1000),
                end_ms=round(seg["end"] * 1000),
            )
            await ws.send_json(msg.model_dump())


@router.websocket("/ws/transcribe")
async def transcribe(ws: WebSocket) -> None:
    """Handle a single transcription session over WebSocket.

    Protocol:
        1. Server accepts connection.
        2. Server sends ``connected`` message with backend info.
        3. Client sends ``configure`` message with desired language.
        4. Server sends ``ready`` message.
        5. Client streams binary PCM int16 audio frames.
           - Server buffers audio and transcribes every 2s, sending ``partial``.
        6. Client sends text ``"stop"`` (or JSON ``{"type":"stop"}``).
           - Server transcribes remainder, sends ``final`` + ``done``.
        7. Connection may close at any time; server handles gracefully.
    """
    await ws.accept()
    engine = TranscriptionEngine.get_instance()

    connected = ConnectedMessage(
        backend=engine.backend,
        device=engine.device,
        model=engine.model_size,
    )
    await ws.send_json(connected.model_dump())

    try:
        # Wait for configure message
        raw = await ws.receive_text()
        config_data = json.loads(raw)
        language = config_data.get("language", "cs")
        logger.info("Session configured: language=%s", language)

        await ws.send_json(ReadyMessage().model_dump())

        # Audio buffer
        chunks: list[np.ndarray] = []
        buffered_samples = 0
        last_transcribed_samples = 0

        while True:
            message = await ws.receive()

            if "bytes" in message and message["bytes"]:
                audio = pcm_to_float32(message["bytes"])
                chunks.append(audio)
                buffered_samples += len(audio)

                new_samples = buffered_samples - last_transcribed_samples

                # Force-finalize at MAX_BUFFER_SAMPLES
                if buffered_samples >= MAX_BUFFER_SAMPLES:
                    all_audio = np.concatenate(chunks)
                    await _transcribe_and_send(ws, engine, all_audio, language, FinalResult)
                    chunks.clear()
                    buffered_samples = 0
                    last_transcribed_samples = 0
                elif new_samples >= MIN_SAMPLES_FOR_TRANSCRIBE:
                    all_audio = np.concatenate(chunks)
                    await _transcribe_and_send(ws, engine, all_audio, language, PartialResult)
                    last_transcribed_samples = buffered_samples

            elif "text" in message and message["text"]:
                text_data = message["text"].strip()

                is_stop = False
                if text_data.lower() == "stop":
                    is_stop = True
                else:
                    try:
                        parsed = json.loads(text_data)
                        if isinstance(parsed, dict) and parsed.get("type") == "stop":
                            is_stop = True
                    except (json.JSONDecodeError, TypeError):
                        pass

                if is_stop:
                    if chunks:
                        all_audio = np.concatenate(chunks)
                        await _transcribe_and_send(ws, engine, all_audio, language, FinalResult)
                    await ws.send_json(DoneMessage().model_dump())
                    break

    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception:
        logger.exception("Error in transcription WebSocket")
        try:
            await ws.close(code=1011, reason="Internal server error")
        except Exception:
            pass
