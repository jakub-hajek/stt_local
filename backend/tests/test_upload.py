"""Tests for the file upload transcription endpoint."""

import io
import struct

import numpy as np
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

from app.engine.factory import TranscriptionEngine
from app.main import app


def _make_wav_bytes(duration_s: float = 0.5, sample_rate: int = 16000) -> bytes:
    """Create a minimal valid WAV file with silence."""
    num_samples = int(duration_s * sample_rate)
    samples = np.zeros(num_samples, dtype=np.int16)

    buf = io.BytesIO()
    # WAV header
    data_size = num_samples * 2  # 16-bit = 2 bytes per sample
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + data_size))
    buf.write(b"WAVE")
    buf.write(b"fmt ")
    buf.write(struct.pack("<I", 16))  # chunk size
    buf.write(struct.pack("<H", 1))  # PCM
    buf.write(struct.pack("<H", 1))  # mono
    buf.write(struct.pack("<I", sample_rate))
    buf.write(struct.pack("<I", sample_rate * 2))  # byte rate
    buf.write(struct.pack("<H", 2))  # block align
    buf.write(struct.pack("<H", 16))  # bits per sample
    buf.write(b"data")
    buf.write(struct.pack("<I", data_size))
    buf.write(samples.tobytes())

    return buf.getvalue()


@pytest.fixture()
def client(loaded_engine):
    """TestClient with a loaded engine."""
    return TestClient(app)


class TestTranscribeFile:
    """Tests for POST /api/transcribe."""

    def test_successful_transcription(self, client):
        wav_bytes = _make_wav_bytes()
        resp = client.post(
            "/api/transcribe",
            files={"file": ("test.wav", wav_bytes, "audio/wav")},
            data={"language": "cs"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "text" in body
        assert "segments" in body
        assert "duration_ms" in body
        assert isinstance(body["segments"], list)

    def test_default_language(self, client):
        wav_bytes = _make_wav_bytes()
        resp = client.post(
            "/api/transcribe",
            files={"file": ("test.wav", wav_bytes, "audio/wav")},
        )
        assert resp.status_code == 200

    def test_engine_not_loaded(self, monkeypatch):
        """Should return 503 when engine is not loaded."""
        monkeypatch.setattr(TranscriptionEngine, "_instance", None)
        engine = TranscriptionEngine.get_instance()
        # Don't call load() — engine stays unloaded

        client = TestClient(app, raise_server_exceptions=False)
        wav_bytes = _make_wav_bytes()
        resp = client.post(
            "/api/transcribe",
            files={"file": ("test.wav", wav_bytes, "audio/wav")},
        )
        assert resp.status_code == 503

    def test_returns_segments_with_timing(self, client, loaded_engine):
        """When the processor returns results, segments include timing."""
        # Patch create_session to return a processor that emits results
        from unittest.mock import MagicMock

        mock_proc = MagicMock()
        mock_proc.insert_audio_chunk = MagicMock()
        mock_proc.process_iter = MagicMock(
            return_value={"text": "hello", "start": 0.0, "end": 1.0}
        )
        mock_proc.finish = MagicMock(
            return_value={"text": "world", "start": 1.0, "end": 2.0}
        )

        with patch.object(loaded_engine, "create_session", return_value=mock_proc):
            wav_bytes = _make_wav_bytes(duration_s=0.1)
            resp = client.post(
                "/api/transcribe",
                files={"file": ("test.wav", wav_bytes, "audio/wav")},
            )

        assert resp.status_code == 200
        body = resp.json()
        assert len(body["segments"]) >= 1
        assert body["text"] != ""


class TestTranscribeRouteRegistered:
    """Test that the upload route is registered on the app."""

    def test_route_exists(self):
        route_paths = [r.path for r in app.routes]
        assert "/api/transcribe" in route_paths
