"""Tests for app.main — app configuration, routes, and CORS middleware."""

import pytest

from app.engine.factory import TranscriptionEngine
from app.main import app


class TestAppExists:
    """Test that the FastAPI app is properly configured."""

    def test_app_title(self):
        assert app.title == "STT Local"

    def test_app_version(self):
        assert app.version == "0.1.0"


class TestAppRoutes:
    """Test that expected routes are registered."""

    def test_health_route_registered(self):
        route_paths = [r.path for r in app.routes]
        assert "/health" in route_paths

    def test_ws_transcribe_route_registered(self):
        route_paths = [r.path for r in app.routes]
        assert "/ws/transcribe" in route_paths


class TestCORSMiddleware:
    """Test that CORS middleware is configured."""

    def test_cors_middleware_present(self):
        middleware_classes = [type(m).__name__ for m in app.user_middleware]
        assert "Middleware" in middleware_classes or len(app.user_middleware) > 0

    def test_options_request_has_cors_headers(self, monkeypatch):
        """Integration test: an OPTIONS request should include CORS headers."""
        from fastapi.testclient import TestClient

        monkeypatch.setattr(TranscriptionEngine, "_instance", None)
        engine = TranscriptionEngine.get_instance()
        engine.load(model_repo="mlx-community/whisper-tiny", language="cs")

        client = TestClient(app)
        resp = client.options(
            "/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert "access-control-allow-origin" in resp.headers


class TestLifespanSetupLogging:
    """Test the _setup_logging helper."""

    def test_setup_logging_does_not_crash(self):
        from app.main import _setup_logging
        _setup_logging()


class TestLifespan:
    """Test the lifespan context manager."""

    @pytest.mark.asyncio
    async def test_lifespan_loads_engine(self, monkeypatch):
        """The lifespan should call get_model_repo and engine.load."""
        from app.main import lifespan

        monkeypatch.setattr(TranscriptionEngine, "_instance", None)

        async with lifespan(app):
            engine = TranscriptionEngine.get_instance()
            assert engine.is_loaded is True
            assert engine.backend == "mlx-whisper"
            assert engine.device == "mps"
