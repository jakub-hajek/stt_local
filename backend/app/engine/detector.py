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
    # 1. Check for macOS ARM64 + mlx-whisper
    if platform.system() == "Darwin" and platform.machine() == "arm64":
        try:
            import mlx_whisper  # noqa: F401

            logger.info("Detected macOS ARM64 with mlx-whisper -> using mlx-whisper on mps")
            return ("mlx-whisper", "mps")
        except ImportError:
            logger.debug("mlx_whisper not importable on macOS ARM64, continuing detection")

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
