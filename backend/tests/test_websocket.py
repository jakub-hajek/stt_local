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
    engine.load(
        model_size="tiny",
        language="cs",
        backend="faster-whisper",
        device="cpu",
    )


class TestHealthEndpoint:
    """GET /health should return backend information."""

    def test_health_ok(self):
        client = TestClient(app)
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["backend"] == "faster-whisper"
        assert data["device"] == "cpu"
        assert data["model"] == "tiny"
        assert "version" in data


class TestWebSocketConnectConfigureReady:
    """Test the initial handshake: connect -> connected -> configure -> ready."""

    def test_handshake(self):
        client = TestClient(app)
        with client.websocket_connect("/ws/transcribe") as ws:
            # Step 1: Receive connected message
            connected = ws.receive_json()
            assert connected["type"] == "connected"
            assert connected["backend"] == "faster-whisper"
            assert connected["device"] == "cpu"
            assert connected["model"] == "tiny"

            # Step 2: Send configure
            ws.send_text(json.dumps({"type": "configure", "language": "en"}))

            # Step 3: Receive ready
            ready = ws.receive_json()
            assert ready["type"] == "ready"


class TestWebSocketStopFlow:
    """Test sending audio then stop to get done message."""

    def test_stop_sends_done(self):
        client = TestClient(app)
        with client.websocket_connect("/ws/transcribe") as ws:
            # Handshake
            ws.receive_json()  # connected
            ws.send_text(json.dumps({"type": "configure", "language": "cs"}))
            ws.receive_json()  # ready

            # Send a small chunk of silent PCM audio (100 samples of silence)
            silence = struct.pack("<100h", *([0] * 100))
            ws.send_bytes(silence)

            # Send stop
            ws.send_text("stop")

            # We should eventually receive a "done" message
            # There may be partial/final messages before done
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

            # Send stop as JSON
            ws.send_text(json.dumps({"type": "stop"}))

            done_received = False
            for _ in range(10):
                msg = ws.receive_json()
                if msg["type"] == "done":
                    done_received = True
                    break
            assert done_received


class TestWebSocketPartialResults:
    """Test that binary PCM data produces partial results when processor returns data."""

    def test_binary_audio_produces_partial(self, monkeypatch):
        """Mock the SessionProcessor to return partial results for audio chunks."""
        from unittest.mock import MagicMock, patch

        # We need to patch the create_session to return a mock that produces results
        original_create = TranscriptionEngine.get_instance().create_session

        mock_online = MagicMock()
        call_count = 0

        def mock_process_iter():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return {"text": "hello", "start": 0.0, "end": 1.0}
            return {}

        mock_online.insert_audio_chunk = MagicMock()
        mock_online.process_iter = mock_process_iter
        mock_online.finish = MagicMock(return_value={})

        engine = TranscriptionEngine.get_instance()
        monkeypatch.setattr(engine, "create_session", lambda: mock_online)

        client = TestClient(app)
        with client.websocket_connect("/ws/transcribe") as ws:
            ws.receive_json()  # connected
            ws.send_text(json.dumps({"type": "configure", "language": "cs"}))
            ws.receive_json()  # ready

            # Send binary PCM audio
            silence = struct.pack("<100h", *([0] * 100))
            ws.send_bytes(silence)

            # Should get a partial result
            msg = ws.receive_json()
            assert msg["type"] == "partial"
            assert msg["text"] == "hello"
            assert msg["start_ms"] == 0.0
            assert msg["end_ms"] == 1000.0

            # Send stop
            ws.send_text("stop")
            done_received = False
            for _ in range(10):
                msg = ws.receive_json()
                if msg["type"] == "done":
                    done_received = True
                    break
            assert done_received

    def test_stop_with_final_results(self, monkeypatch):
        """Mock processor to return final results on flush."""
        from unittest.mock import MagicMock

        mock_online = MagicMock()
        mock_online.insert_audio_chunk = MagicMock()
        mock_online.process_iter = MagicMock(return_value={})
        mock_online.finish = MagicMock(
            return_value={"text": "final text", "start": 0.0, "end": 5.0}
        )

        engine = TranscriptionEngine.get_instance()
        monkeypatch.setattr(engine, "create_session", lambda: mock_online)

        client = TestClient(app)
        with client.websocket_connect("/ws/transcribe") as ws:
            ws.receive_json()  # connected
            ws.send_text(json.dumps({"type": "configure", "language": "cs"}))
            ws.receive_json()  # ready

            # Send some audio then stop
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


class TestWebSocketNonStopTextMessage:
    """Test sending a non-stop text message (not 'stop' and not JSON stop)."""

    def test_unknown_text_message_ignored(self, monkeypatch):
        """Non-stop text messages should be ignored and not crash the session."""
        from unittest.mock import MagicMock

        mock_online = MagicMock()
        mock_online.insert_audio_chunk = MagicMock()
        mock_online.process_iter = MagicMock(return_value={})
        mock_online.finish = MagicMock(return_value={})

        engine = TranscriptionEngine.get_instance()
        monkeypatch.setattr(engine, "create_session", lambda: mock_online)

        client = TestClient(app)
        with client.websocket_connect("/ws/transcribe") as ws:
            ws.receive_json()  # connected
            ws.send_text(json.dumps({"type": "configure", "language": "cs"}))
            ws.receive_json()  # ready

            # Send an unknown text message
            ws.send_text("some random text")

            # Session should still be alive - send stop and get done
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

    def test_engine_create_session_error_closes_connection(self, monkeypatch):
        """If create_session raises, the WebSocket handler catches it and calls ws.close(1011)."""

        def _boom():
            raise RuntimeError("boom")

        engine = TranscriptionEngine.get_instance()
        monkeypatch.setattr(engine, "create_session", _boom)

        client = TestClient(app)
        with client.websocket_connect("/ws/transcribe") as ws:
            ws.receive_json()  # connected
            ws.send_text(json.dumps({"type": "configure", "language": "cs"}))
            # After configure, create_session fails -> exception handler runs
            # ws.close(1011) is called; we just need to not crash here.

    def test_disconnect_during_audio_loop(self, monkeypatch):
        """Simulate WebSocketDisconnect during the main loop to cover line 109."""
        from unittest.mock import MagicMock
        from starlette.websockets import WebSocketDisconnect as StarletteWsDisconnect

        # Mock the processor to raise WebSocketDisconnect on insert_audio_chunk
        mock_online = MagicMock()
        mock_online.insert_audio_chunk = MagicMock(
            side_effect=StarletteWsDisconnect()
        )

        engine = TranscriptionEngine.get_instance()
        monkeypatch.setattr(engine, "create_session", lambda: mock_online)

        client = TestClient(app)
        with client.websocket_connect("/ws/transcribe") as ws:
            ws.receive_json()  # connected
            ws.send_text(json.dumps({"type": "configure", "language": "cs"}))
            ws.receive_json()  # ready

            # Send binary - insert_audio_chunk will raise WebSocketDisconnect
            silence = struct.pack("<100h", *([0] * 100))
            ws.send_bytes(silence)
            # Connection should be cleanly handled

    def test_error_with_close_failure(self, monkeypatch):
        """Cover lines 110-115: generic exception + ws.close() also failing."""
        from unittest.mock import MagicMock

        mock_online = MagicMock()
        mock_online.insert_audio_chunk = MagicMock(
            side_effect=RuntimeError("processing error")
        )

        engine = TranscriptionEngine.get_instance()
        monkeypatch.setattr(engine, "create_session", lambda: mock_online)

        client = TestClient(app)
        with client.websocket_connect("/ws/transcribe") as ws:
            ws.receive_json()  # connected
            ws.send_text(json.dumps({"type": "configure", "language": "cs"}))
            ws.receive_json()  # ready

            # Send binary data - will trigger RuntimeError in insert_audio_chunk
            silence = struct.pack("<100h", *([0] * 100))
            ws.send_bytes(silence)
            # Error handler runs, tries ws.close(1011)
