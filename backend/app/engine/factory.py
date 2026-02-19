"""Thread-safe singleton for mlx-whisper transcription engine."""

import asyncio
import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


class TranscriptionEngine:
    """Singleton wrapper around mlx_whisper.transcribe().

    Loads the model once at startup (via a warm-up call) and provides
    a thread-safe transcribe() method for all routes.

    All MLX calls are serialized through a single dedicated thread to
    avoid Metal GPU memory corruption from concurrent thread access.
    """

    _instance: "TranscriptionEngine | None" = None
    _lock = threading.Lock()

    def __init__(self) -> None:
        self._model_repo: str = ""
        self._language: str = ""
        self._loaded = False
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="mlx")

    @classmethod
    def get_instance(cls) -> "TranscriptionEngine":
        """Return the singleton instance, creating it if necessary."""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    @classmethod
    def reset_instance(cls) -> None:
        """Reset singleton (for testing only)."""
        with cls._lock:
            cls._instance = None

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @property
    def model_size(self) -> str:
        return self._model_repo

    @property
    def backend(self) -> str:
        return "mlx-whisper" if self._loaded else ""

    @property
    def device(self) -> str:
        return "mps" if self._loaded else ""

    def load(self, model_repo: str, language: str) -> None:
        """Load the model by running a warm-up transcription on silence."""
        with self._lock:
            if self._loaded:
                logger.warning("TranscriptionEngine already loaded, skipping reload")
                return

            logger.info("Loading model: repo=%s, language=%s", model_repo, language)

            import mlx_whisper

            # Warm-up: transcribe 1 second of silence to load weights
            silence = np.zeros(16000, dtype=np.float32)
            mlx_whisper.transcribe(
                silence,
                path_or_hf_repo=model_repo,
                language=language,
            )

            self._model_repo = model_repo
            self._language = language
            self._loaded = True

            logger.info("Model loaded successfully")

    def transcribe(self, audio: np.ndarray, language: str | None = None) -> dict:
        """Transcribe audio synchronously using mlx_whisper.

        Args:
            audio: Float32 numpy array of audio samples at 16kHz.
            language: Override language (defaults to engine language).

        Returns:
            The mlx_whisper result dict with 'text' and 'segments' keys.
        """
        if not self._loaded:
            raise RuntimeError(
                "TranscriptionEngine has not been loaded. Call load() first."
            )

        import mlx_whisper

        return mlx_whisper.transcribe(
            audio,
            path_or_hf_repo=self._model_repo,
            language=language or self._language,
        )

    async def transcribe_async(self, audio: np.ndarray, language: str | None = None) -> dict:
        """Transcribe audio without blocking the event loop.

        All calls are serialized through a single-thread executor to
        prevent concurrent Metal GPU access which causes memory corruption.
        """
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            self._executor, self.transcribe, audio, language
        )
