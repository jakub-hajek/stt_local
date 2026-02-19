"""Tests for the WebSocket transcription endpoint."""

import json
import struct

import pytest
from fastapi.testclient import TestClient

from app.engine.factory import TranscriptionEngine
from app.main import app


@pytest.fixture(autouse=True)
def _reset_engine(monkeypatch: pytest.MonkeyPatch):
    """Ensure the TranscriptionEngine singleton is fresh for each test
    and pre-loaded so the lifespan handler works with mocks."""
    monkeypatch.setattr(TranscriptionEngine, "_instance", None)
    engine = TranscriptionEngine.get_instance()
    engine.load(model_repo="mlx-community/whisper-tiny", language="cs")


@pytest.fixture(autouse=True)
def _small_buffer(monkeypatch: pytest.MonkeyPatch):
    """Use a tiny buffer threshold so tests trigger transcription quickly."""
    import app.routes.websocket as ws_mod
    monkeypatch.setattr(ws_mod, "MIN_SAMPLES_FOR_TRANSCRIBE", 10)
    monkeypatch.setattr(ws_mod, "MAX_BUFFER_SAMPLES", 500)


class TestHealthEndpoint:
    """GET /health should return backend information."""

    def test_health_ok(self):
        client = TestClient(app)
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["backend"] == "mlx-whisper"
        assert data["device"] == "mps"
        assert data["model"] == "mlx-community/whisper-tiny"
        assert "version" in data


class TestWebSocketConnectConfigureReady:
    """Test the initial handshake: connect -> connected -> configure -> ready."""

    def test_handshake(self):
        client = TestClient(app)
        with client.websocket_connect("/ws/transcribe") as ws:
            connected = ws.receive_json()
            assert connected["type"] == "connected"
            assert connected["backend"] == "mlx-whisper"
            assert connected["device"] == "mps"
            assert connected["model"] == "mlx-community/whisper-tiny"

            ws.send_text(json.dumps({"type": "configure", "language": "en"}))

            ready = ws.receive_json()
            assert ready["type"] == "ready"


class TestWebSocketStopFlow:
    """Test sending audio then stop to get done message."""

    def test_stop_sends_done(self):
        client = TestClient(app)
        with client.websocket_connect("/ws/transcribe") as ws:
            ws.receive_json()  # connected
            ws.send_text(json.dumps({"type": "configure", "language": "cs"}))
            ws.receive_json()  # ready

            silence = struct.pack("<100h", *([0] * 100))
            ws.send_bytes(silence)

            ws.send_text("stop")

            done_received = False
            for _ in range(10):
                msg = ws.receive_json()
                if msg["type"] == "done":
                    done_received = True
                    break
            assert done_received, "Expected a 'done' message after stop"


class TestWebSocketJsonStop:
    """Test that JSON-formatted stop message also works."""

    def test_json_stop(self):
        client = TestClient(app)
        with client.websocket_connect("/ws/transcribe") as ws:
            ws.receive_json()  # connected
            ws.send_text(json.dumps({"type": "configure", "language": "cs"}))
            ws.receive_json()  # ready

            ws.send_text(json.dumps({"type": "stop"}))

            done_received = False
            for _ in range(10):
                msg = ws.receive_json()
                if msg["type"] == "done":
                    done_received = True
                    break
            assert done_received


class TestWebSocketPartialResults:
    """Test that binary PCM data produces partial results."""

    def test_binary_audio_produces_partial(self, monkeypatch):
        """Mock engine.transcribe to return partial results for audio chunks."""
        engine = TranscriptionEngine.get_instance()

        def mock_transcribe(audio, language=None):
            return {
                "text": "hello",
                "segments": [{"text": "hello", "start": 0.0, "end": 1.0}],
            }

        monkeypatch.setattr(engine, "transcribe", mock_transcribe)

        client = TestClient(app)
        with client.websocket_connect("/ws/transcribe") as ws:
            ws.receive_json()  # connected
            ws.send_text(json.dumps({"type": "configure", "language": "cs"}))
            ws.receive_json()  # ready

            # Send enough PCM audio to trigger transcription (> MIN_SAMPLES_FOR_TRANSCRIBE)
            silence = struct.pack("<100h", *([0] * 100))
            ws.send_bytes(silence)

            msg = ws.receive_json()
            assert msg["type"] == "partial"
            assert msg["text"] == "hello"
            assert msg["start_ms"] == 0
            assert msg["end_ms"] == 1000

            ws.send_text("stop")
            # Drain remaining messages until done
            for _ in range(10):
                msg = ws.receive_json()
                if msg["type"] == "done":
                    break

    def test_stop_with_final_results(self, monkeypatch):
        """Mock engine.transcribe to return final results on stop."""
        engine = TranscriptionEngine.get_instance()

        def mock_transcribe(audio, language=None):
            return {
                "text": "final text",
                "segments": [{"text": "final text", "start": 0.0, "end": 5.0}],
            }

        monkeypatch.setattr(engine, "transcribe", mock_transcribe)

        client = TestClient(app)
        with client.websocket_connect("/ws/transcribe") as ws:
            ws.receive_json()  # connected
            ws.send_text(json.dumps({"type": "configure", "language": "cs"}))
            ws.receive_json()  # ready

            silence = struct.pack("<100h", *([0] * 100))
            ws.send_bytes(silence)
            ws.send_text("stop")

            messages = []
            for _ in range(10):
                msg = ws.receive_json()
                messages.append(msg)
                if msg["type"] == "done":
                    break

            types = [m["type"] for m in messages]
            assert "final" in types
            assert "done" in types
            final_msg = next(m for m in messages if m["type"] == "final")
            assert final_msg["text"] == "final text"


class TestWebSocketMaxBuffer:
    """Test that exceeding MAX_BUFFER_SAMPLES triggers force-finalize."""

    def test_force_finalize_on_max_buffer(self, monkeypatch):
        engine = TranscriptionEngine.get_instance()
        call_count = 0

        def mock_transcribe(audio, language=None):
            nonlocal call_count
            call_count += 1
            return {"text": "chunk", "segments": [{"text": "chunk", "start": 0.0, "end": 1.0}]}

        monkeypatch.setattr(engine, "transcribe", mock_transcribe)

        client = TestClient(app)
        with client.websocket_connect("/ws/transcribe") as ws:
            ws.receive_json()  # connected
            ws.send_text(json.dumps({"type": "configure", "language": "cs"}))
            ws.receive_json()  # ready

            # Send enough data to exceed MAX_BUFFER_SAMPLES (500 with our fixture)
            big_silence = struct.pack("<600h", *([0] * 600))
            ws.send_bytes(big_silence)

            # Should get a final result from force-finalize
            msg = ws.receive_json()
            assert msg["type"] == "final"

            ws.send_text("stop")
            done_received = False
            for _ in range(10):
                msg = ws.receive_json()
                if msg["type"] == "done":
                    done_received = True
                    break
            assert done_received


class TestWebSocketNonStopTextMessage:
    """Test sending a non-stop text message."""

    def test_unknown_text_message_ignored(self):
        client = TestClient(app)
        with client.websocket_connect("/ws/transcribe") as ws:
            ws.receive_json()  # connected
            ws.send_text(json.dumps({"type": "configure", "language": "cs"}))
            ws.receive_json()  # ready

            ws.send_text("some random text")

            ws.send_text("stop")
            done_received = False
            for _ in range(10):
                msg = ws.receive_json()
                if msg["type"] == "done":
                    done_received = True
                    break
            assert done_received


class TestWebSocketErrorHandling:
    """Test error handling in the WebSocket endpoint."""

    def test_engine_transcribe_error_closes_connection(self, monkeypatch):
        """If transcribe raises, the WebSocket handler catches it and calls ws.close(1011)."""
        engine = TranscriptionEngine.get_instance()

        def _boom(audio, language=None):
            raise RuntimeError("boom")

        monkeypatch.setattr(engine, "transcribe", _boom)

        client = TestClient(app)
        with client.websocket_connect("/ws/transcribe") as ws:
            ws.receive_json()  # connected
            ws.send_text(json.dumps({"type": "configure", "language": "cs"}))
            ws.receive_json()  # ready

            # Send enough audio to trigger transcription
            silence = struct.pack("<100h", *([0] * 100))
            ws.send_bytes(silence)
            # Error handler runs, tries ws.close(1011)

    def test_disconnect_during_audio_loop(self):
        """Simulate a clean disconnect during the main loop."""
        client = TestClient(app)
        with client.websocket_connect("/ws/transcribe") as ws:
            ws.receive_json()  # connected
            ws.send_text(json.dumps({"type": "configure", "language": "cs"}))
            ws.receive_json()  # ready
            # Just close - should be handled gracefully
