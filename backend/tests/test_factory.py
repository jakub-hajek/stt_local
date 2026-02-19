"""Tests for app.engine.factory.TranscriptionEngine."""

import pytest

from app.engine.factory import TranscriptionEngine


class TestResetInstance:
    """Test reset_instance clears the singleton."""

    def test_reset_clears_singleton(self, monkeypatch):
        monkeypatch.setattr(TranscriptionEngine, "_instance", None)
        engine = TranscriptionEngine.get_instance()
        assert TranscriptionEngine._instance is engine

        TranscriptionEngine.reset_instance()
        assert TranscriptionEngine._instance is None

    def test_get_instance_after_reset_creates_new(self, monkeypatch):
        monkeypatch.setattr(TranscriptionEngine, "_instance", None)
        engine1 = TranscriptionEngine.get_instance()
        TranscriptionEngine.reset_instance()
        engine2 = TranscriptionEngine.get_instance()
        assert engine1 is not engine2


class TestTranscribeNotLoaded:
    """Test transcribe raises RuntimeError when not loaded."""

    def test_transcribe_raises_when_not_loaded(self, monkeypatch):
        monkeypatch.setattr(TranscriptionEngine, "_instance", None)
        engine = TranscriptionEngine.get_instance()
        with pytest.raises(RuntimeError, match="has not been loaded"):
            import numpy as np
            engine.transcribe(np.zeros(100, dtype=np.float32))


class TestDoubleLoadWarning:
    """Test that loading twice logs a warning and skips reload."""

    def test_double_load_skips(self, loaded_engine):
        assert loaded_engine.is_loaded is True
        loaded_engine.load(model_repo="mlx-community/whisper-tiny", language="cs")
        assert loaded_engine.is_loaded is True
        assert loaded_engine.model_size == "mlx-community/whisper-tiny"


class TestTranscribeDelegation:
    """Test that transcribe delegates to mlx_whisper."""

    def test_transcribe_returns_result(self, loaded_engine):
        import numpy as np
        result = loaded_engine.transcribe(np.zeros(16000, dtype=np.float32))
        assert "text" in result
        assert "segments" in result

    def test_transcribe_with_language_override(self, loaded_engine, monkeypatch):
        import sys
        import numpy as np

        calls = []
        original_mod = sys.modules["mlx_whisper"]

        def _tracking_transcribe(audio, *, path_or_hf_repo="", language="cs", **kwargs):
            calls.append(language)
            return {"text": "", "segments": []}

        monkeypatch.setattr(original_mod, "transcribe", _tracking_transcribe)

        loaded_engine.transcribe(np.zeros(16000, dtype=np.float32), language="en")
        assert calls[-1] == "en"


class TestEngineProperties:
    """Test engine properties reflect loaded state."""

    def test_properties_before_load(self, monkeypatch):
        monkeypatch.setattr(TranscriptionEngine, "_instance", None)
        engine = TranscriptionEngine.get_instance()
        assert engine.is_loaded is False
        assert engine.model_size == ""
        assert engine.backend == ""
        assert engine.device == ""

    def test_properties_after_load(self, loaded_engine):
        assert loaded_engine.is_loaded is True
        assert loaded_engine.model_size == "mlx-community/whisper-tiny"
        assert loaded_engine.backend == "mlx-whisper"
        assert loaded_engine.device == "mps"
