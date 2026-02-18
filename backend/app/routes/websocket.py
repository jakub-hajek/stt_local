"""WebSocket endpoint for real-time transcription."""

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.audio.normalizer import pcm_to_float32
from app.engine.factory import TranscriptionEngine
from app.engine.processor import SessionProcessor
from app.models import (
    ConnectedMessage,
    DoneMessage,
    FinalResult,
    PartialResult,
    ReadyMessage,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/transcribe")
async def transcribe(ws: WebSocket) -> None:
    """Handle a single transcription session over WebSocket.

    Protocol:
        1. Server accepts connection.
        2. Server sends ``connected`` message with backend info.
        3. Client sends ``configure`` message with desired language.
        4. Server sends ``ready`` message.
        5. Client streams binary PCM int16 audio frames.
           - Server replies with ``partial`` results as they become available.
        6. Client sends text ``"stop"`` (or JSON ``{"type":"stop"}``).
           - Server flushes, sends ``final`` results, then ``done``.
        7. Connection may close at any time; server handles gracefully.
    """
    await ws.accept()
    engine = TranscriptionEngine.get_instance()

    # Step 2: Send connected message
    connected = ConnectedMessage(
        backend=engine.backend,
        device=engine.device,
        model=engine.model_size,
    )
    await ws.send_json(connected.model_dump())

    try:
        # Step 3: Wait for configure message
        raw = await ws.receive_text()
        config_data = json.loads(raw)
        language = config_data.get("language", "cs")
        logger.info("Session configured: language=%s", language)

        # Step 4: Send ready message
        await ws.send_json(ReadyMessage().model_dump())

        # Create a per-session processor
        online_processor = engine.create_session()
        session = SessionProcessor(online_processor)

        # Step 5: Main loop
        while True:
            message = await ws.receive()

            # Binary frame: PCM audio data
            if "bytes" in message and message["bytes"]:
                audio = pcm_to_float32(message["bytes"])
                partials = session.feed_audio(audio)
                for text, start_ms, end_ms in partials:
                    partial_msg = PartialResult(
                        text=text,
                        start_ms=start_ms,
                        end_ms=end_ms,
                    )
                    await ws.send_json(partial_msg.model_dump())

            # Text frame: control message
            elif "text" in message and message["text"]:
                text_data = message["text"].strip()

                # Handle both plain "stop" and JSON {"type": "stop"}
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
                    # Step 6: Flush and send final results
                    finals = session.flush()
                    for text, start_ms, end_ms in finals:
                        final_msg = FinalResult(
                            text=text,
                            start_ms=start_ms,
                            end_ms=end_ms,
                        )
                        await ws.send_json(final_msg.model_dump())
                    await ws.send_json(DoneMessage().model_dump())

    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception:
        logger.exception("Error in transcription WebSocket")
        try:
            await ws.close(code=1011, reason="Internal server error")
        except Exception:
            pass
