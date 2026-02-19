"""Shared test fixtures for the STT Local backend test suite."""

import sys
from types import ModuleType

import numpy as np
import pytest


@pytest.fixture(autouse=True)
def _mock_mlx_whisper(monkeypatch: pytest.MonkeyPatch) -> None:
    """Provide a stub ``mlx_whisper`` module so tests can run
    without the real (heavy) mlx-whisper dependency installed."""
    mod = ModuleType("mlx_whisper")

    def _transcribe(audio, *, path_or_hf_repo: str = "", language: str = "cs", **kwargs):
        """Return empty transcription result by default."""
        return {"text": "", "segments": []}

    mod.transcribe = _transcribe  # type: ignore[attr-defined]

    monkeypatch.setitem(sys.modules, "mlx_whisper", mod)


@pytest.fixture()
def loaded_engine(monkeypatch: pytest.MonkeyPatch) -> "TranscriptionEngine":
    """Return a TranscriptionEngine singleton that has been loaded with mocks."""
    from app.engine.factory import TranscriptionEngine

    monkeypatch.setattr(TranscriptionEngine, "_instance", None)
    engine = TranscriptionEngine.get_instance()
    engine.load(model_repo="mlx-community/whisper-tiny", language="cs")
    return engine
