"""Auto-detect the best available transcription backend and device."""

import logging
import platform
import sys

logger = logging.getLogger(__name__)


def detect_backend() -> tuple[str, str]:
    """Detect the best available backend and device.

    Detection order:
      1. macOS ARM64 with mlx-whisper installed  -> ("mlx-whisper", "mps")
      2. CUDA available with faster-whisper       -> ("faster-whisper", "cuda")
      3. Fallback                                 -> ("faster-whisper", "cpu")

    Returns:
        Tuple of (backend_name, device_name).
    """
    # 1. Check for macOS ARM64 + mlx-whisper + PyTorch MPS availability
    if platform.system() == "Darwin" and platform.machine() == "arm64":
        has_mlx_whisper = False
        try:
            import mlx_whisper  # noqa: F401

            has_mlx_whisper = True
        except ImportError:
            logger.warning(
                "Apple Silicon detected but mlx-whisper is not installed. "
                "Run `make install-be` to install backend MPS dependencies."
            )

        if has_mlx_whisper:
            try:
                import torch

                if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                    logger.info(
                        "Detected macOS ARM64 with mlx-whisper and MPS -> using mlx-whisper on mps"
                    )
                    return ("mlx-whisper", "mps")
                logger.warning(
                    "Apple Silicon detected and mlx-whisper installed, "
                    "but PyTorch MPS is unavailable. Falling back."
                )
            except ImportError:
                logger.warning(
                    "Apple Silicon detected and mlx-whisper installed, "
                    "but torch is not importable. Falling back."
                )

    # 2. Check for CUDA + faster-whisper
    try:
        import torch

        if torch.cuda.is_available():
            try:
                import faster_whisper  # noqa: F401

                logger.info("Detected CUDA with faster-whisper -> using faster-whisper on cuda")
                return ("faster-whisper", "cuda")
            except ImportError:
                logger.debug("faster_whisper not importable despite CUDA availability")
    except ImportError:
        logger.debug("torch not importable, skipping CUDA detection")

    # 3. Fallback
    logger.info("Falling back to faster-whisper on cpu")
    return ("faster-whisper", "cpu")
