"""Tests for app.engine.detector.detect_backend()."""

import sys
from types import ModuleType
from unittest.mock import MagicMock, patch

from app.engine.detector import detect_backend


class TestDetectBackendMacOSMlx:
    """When running on macOS ARM64 with mlx_whisper available."""

    def test_returns_mlx_whisper_mps(self, monkeypatch: "pytest.MonkeyPatch"):
        # Simulate macOS ARM64
        with (
            patch("app.engine.detector.platform.system", return_value="Darwin"),
            patch("app.engine.detector.platform.machine", return_value="arm64"),
        ):
            # Make mlx_whisper importable
            fake_mlx = ModuleType("mlx_whisper")
            monkeypatch.setitem(sys.modules, "mlx_whisper", fake_mlx)
            mock_torch = MagicMock()
            mock_torch.backends.mps.is_available.return_value = True
            monkeypatch.setitem(sys.modules, "torch", mock_torch)

            backend, device = detect_backend()

        assert backend == "mlx-whisper"
        assert device == "mps"

    def test_falls_through_when_mps_unavailable(self, monkeypatch: "pytest.MonkeyPatch"):
        with (
            patch("app.engine.detector.platform.system", return_value="Darwin"),
            patch("app.engine.detector.platform.machine", return_value="arm64"),
        ):
            fake_mlx = ModuleType("mlx_whisper")
            monkeypatch.setitem(sys.modules, "mlx_whisper", fake_mlx)
            mock_torch = MagicMock()
            mock_torch.backends.mps.is_available.return_value = False
            mock_torch.cuda.is_available.return_value = False
            monkeypatch.setitem(sys.modules, "torch", mock_torch)

            backend, device = detect_backend()

        assert backend == "faster-whisper"
        assert device == "cpu"


class TestDetectBackendCuda:
    """When CUDA is available with faster_whisper."""

    def test_returns_faster_whisper_cuda(self, monkeypatch: "pytest.MonkeyPatch"):
        # Not macOS ARM64
        with (
            patch("app.engine.detector.platform.system", return_value="Linux"),
            patch("app.engine.detector.platform.machine", return_value="x86_64"),
        ):
            # Remove mlx_whisper if present
            monkeypatch.delitem(sys.modules, "mlx_whisper", raising=False)

            # Mock torch.cuda.is_available
            mock_torch = MagicMock()
            mock_torch.cuda.is_available.return_value = True
            monkeypatch.setitem(sys.modules, "torch", mock_torch)

            # Make faster_whisper importable
            fake_fw = ModuleType("faster_whisper")
            monkeypatch.setitem(sys.modules, "faster_whisper", fake_fw)

            backend, device = detect_backend()

        assert backend == "faster-whisper"
        assert device == "cuda"


class TestDetectBackendMacOSNoMlx:
    """When on macOS ARM64 but mlx_whisper is NOT importable (lines 28-29)."""

    def test_falls_through_when_mlx_not_available(self, monkeypatch: "pytest.MonkeyPatch"):
        with (
            patch("app.engine.detector.platform.system", return_value="Darwin"),
            patch("app.engine.detector.platform.machine", return_value="arm64"),
        ):
            # Make mlx_whisper NOT importable
            monkeypatch.delitem(sys.modules, "mlx_whisper", raising=False)

            original_import = __builtins__.__import__ if hasattr(__builtins__, "__import__") else __import__

            def _import_no_mlx(name, *args, **kwargs):
                if name == "mlx_whisper":
                    raise ImportError("no mlx_whisper")
                return original_import(name, *args, **kwargs)

            monkeypatch.setattr("builtins.__import__", _import_no_mlx)

            # Also no torch so it falls to CPU
            def _import_no_mlx_no_torch(name, *args, **kwargs):
                if name in ("mlx_whisper", "torch"):
                    raise ImportError(f"no {name}")
                return original_import(name, *args, **kwargs)

            monkeypatch.setattr("builtins.__import__", _import_no_mlx_no_torch)

            backend, device = detect_backend()

        assert backend == "faster-whisper"
        assert device == "cpu"


class TestDetectBackendCudaNoFasterWhisper:
    """When CUDA is available but faster_whisper is NOT importable (lines 41-42)."""

    def test_falls_to_cpu_when_faster_whisper_missing(self, monkeypatch: "pytest.MonkeyPatch"):
        with (
            patch("app.engine.detector.platform.system", return_value="Linux"),
            patch("app.engine.detector.platform.machine", return_value="x86_64"),
        ):
            monkeypatch.delitem(sys.modules, "mlx_whisper", raising=False)

            # Mock torch with CUDA available
            mock_torch = MagicMock()
            mock_torch.cuda.is_available.return_value = True
            monkeypatch.setitem(sys.modules, "torch", mock_torch)

            # Make faster_whisper NOT importable
            monkeypatch.delitem(sys.modules, "faster_whisper", raising=False)

            original_import = __builtins__.__import__ if hasattr(__builtins__, "__import__") else __import__

            def _import_no_fw(name, *args, **kwargs):
                if name == "faster_whisper":
                    raise ImportError("no faster_whisper")
                return original_import(name, *args, **kwargs)

            monkeypatch.setattr("builtins.__import__", _import_no_fw)

            backend, device = detect_backend()

        assert backend == "faster-whisper"
        assert device == "cpu"


class TestDetectBackendCpuFallback:
    """When no accelerator is available."""

    def test_returns_faster_whisper_cpu(self, monkeypatch: "pytest.MonkeyPatch"):
        with (
            patch("app.engine.detector.platform.system", return_value="Linux"),
            patch("app.engine.detector.platform.machine", return_value="x86_64"),
        ):
            monkeypatch.delitem(sys.modules, "mlx_whisper", raising=False)

            # torch says no CUDA
            mock_torch = MagicMock()
            mock_torch.cuda.is_available.return_value = False
            monkeypatch.setitem(sys.modules, "torch", mock_torch)

            backend, device = detect_backend()

        assert backend == "faster-whisper"
        assert device == "cpu"

    def test_returns_cpu_when_torch_not_available(self, monkeypatch: "pytest.MonkeyPatch"):
        with (
            patch("app.engine.detector.platform.system", return_value="Linux"),
            patch("app.engine.detector.platform.machine", return_value="x86_64"),
        ):
            monkeypatch.delitem(sys.modules, "mlx_whisper", raising=False)

            # Make torch import fail
            original_import = __builtins__.__import__ if hasattr(__builtins__, "__import__") else __import__

            def _import_no_torch(name, *args, **kwargs):
                if name == "torch":
                    raise ImportError("no torch")
                return original_import(name, *args, **kwargs)

            monkeypatch.setattr("builtins.__import__", _import_no_torch)

            backend, device = detect_backend()

        assert backend == "faster-whisper"
        assert device == "cpu"
