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


class TestCreateSessionNotLoaded:
    """Test create_session raises RuntimeError when not loaded."""

    def test_create_session_raises_when_not_loaded(self, monkeypatch):
        monkeypatch.setattr(TranscriptionEngine, "_instance", None)
        engine = TranscriptionEngine.get_instance()
        # Engine is NOT loaded
        with pytest.raises(RuntimeError, match="has not been loaded"):
            engine.create_session()


class TestDoubleLoadWarning:
    """Test that loading twice logs a warning and skips reload."""

    def test_double_load_skips(self, loaded_engine):
        """loaded_engine is already loaded; calling load again should not crash."""
        assert loaded_engine.is_loaded is True
        # Call load again - should just log warning and return
        loaded_engine.load(
            model_size="tiny",
            language="cs",
            backend="faster-whisper",
            device="cpu",
        )
        # Still loaded, same state
        assert loaded_engine.is_loaded is True
        assert loaded_engine.model_size == "tiny"


class TestCreateSessionWhenLoaded:
    """Test create_session returns a new processor when loaded."""

    def test_create_session_returns_processor(self, loaded_engine):
        session = loaded_engine.create_session()
        assert session is not None
        # Should be a fresh instance each time
        session2 = loaded_engine.create_session()
        assert session is not session2


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
        assert loaded_engine.model_size == "tiny"
        assert loaded_engine.backend == "faster-whisper"
        assert loaded_engine.device == "cpu"
