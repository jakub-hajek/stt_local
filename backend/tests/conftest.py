"""Shared test fixtures for the STT Local backend test suite."""

import sys
from types import ModuleType
from unittest.mock import MagicMock

import pytest


@pytest.fixture(autouse=True)
def _mock_simulstreaming(monkeypatch: pytest.MonkeyPatch) -> None:
    """Provide a stub ``simulstreaming_whisper`` module so tests can run
    without the real (heavy) SimulStreaming dependency installed."""
    mod = ModuleType("simulstreaming_whisper")

    def _simulwhisper_args(parser):
        parser.add_argument("--model_path", type=str, default="tiny")
        parser.add_argument("--beams", type=int, default=1)
        parser.add_argument("--frame_threshold", type=float, default=25)

    class _MockOnlineProcessor:
        """Mimics SimulWhisperOnline interface."""

        def __init__(self, asr=None):
            self.asr = asr
            self.init()

        def init(self, offset=None):
            self.audio_chunks = []
            self.is_last = False

        def insert_audio_chunk(self, audio):
            self.audio_chunks.append(audio)

        def process_iter(self):
            # Return empty dict (no output) by default
            return {}

        def finish(self):
            self.is_last = True
            return {}

    def _simul_asr_factory(args):
        asr = MagicMock(name="mock_asr")
        processor = _MockOnlineProcessor(asr)
        return asr, processor

    mod.simulwhisper_args = _simulwhisper_args  # type: ignore[attr-defined]
    mod.simul_asr_factory = _simul_asr_factory  # type: ignore[attr-defined]

    monkeypatch.setitem(sys.modules, "simulstreaming_whisper", mod)


@pytest.fixture()
def loaded_engine(monkeypatch: pytest.MonkeyPatch) -> "TranscriptionEngine":
    """Return a TranscriptionEngine singleton that has been loaded with mocks."""
    from app.engine.factory import TranscriptionEngine

    monkeypatch.setattr(TranscriptionEngine, "_instance", None)
    engine = TranscriptionEngine.get_instance()
    engine.load(
        model_size="tiny",
        language="cs",
        backend="faster-whisper",
        device="cpu",
    )
    return engine
