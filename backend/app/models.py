"""Pydantic schemas for WebSocket message protocol."""

from typing import Literal

from pydantic import BaseModel


# --- Server -> Client messages ---


class ConnectedMessage(BaseModel):
    """Sent immediately after WebSocket connection is accepted."""

    type: Literal["connected"] = "connected"
    backend: str
    device: str
    model: str


class ReadyMessage(BaseModel):
    """Sent after the server has processed a configure message."""

    type: Literal["ready"] = "ready"


class PartialResult(BaseModel):
    """Intermediate transcription result (may change)."""

    type: Literal["partial"] = "partial"
    text: str
    start_ms: float
    end_ms: float


class FinalResult(BaseModel):
    """Committed transcription result (will not change)."""

    type: Literal["final"] = "final"
    text: str
    start_ms: float
    end_ms: float


class DoneMessage(BaseModel):
    """Sent after flushing is complete to signal end of a transcription segment."""

    type: Literal["done"] = "done"


# --- Client -> Server messages ---


class ConfigureMessage(BaseModel):
    """Client sends this to configure the transcription session."""

    type: Literal["configure"] = "configure"
    language: str


class StopMessage(BaseModel):
    """Client sends this to request flushing and finalisation."""

    type: Literal["stop"] = "stop"
