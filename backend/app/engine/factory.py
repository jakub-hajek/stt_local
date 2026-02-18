"""Thread-safe singleton for the SimulStreaming transcription engine."""

import argparse
import logging
import threading
from typing import Any

logger = logging.getLogger(__name__)


class TranscriptionEngine:
    """Singleton wrapper around SimulStreaming's simul_asr_factory.

    Manages loading the model once and creating per-session online
    processors in a thread-safe manner.
    """

    _instance: "TranscriptionEngine | None" = None
    _lock = threading.Lock()

    def __init__(self) -> None:
        self._asr: Any = None
        self._online_class: Any = None
        self._model_size: str = ""
        self._language: str = ""
        self._backend: str = ""
        self._device: str = ""
        self._loaded = False

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
        return self._model_size

    @property
    def backend(self) -> str:
        return self._backend

    @property
    def device(self) -> str:
        return self._device

    def load(
        self,
        model_size: str,
        language: str,
        backend: str,
        device: str,
    ) -> None:
        """Load the ASR model via SimulStreaming's simul_asr_factory.

        This should be called once during application startup.
        """
        with self._lock:
            if self._loaded:
                logger.warning("TranscriptionEngine already loaded, skipping reload")
                return

            logger.info(
                "Loading model: size=%s, language=%s, backend=%s, device=%s",
                model_size,
                language,
                backend,
                device,
            )

            from simulstreaming_whisper import simul_asr_factory, simulwhisper_args

            parser = argparse.ArgumentParser()
            parser.add_argument("--min-chunk-size", type=float, default=1.2)
            parser.add_argument("--lan", type=str, default=language)
            parser.add_argument("--task", type=str, default="transcribe")
            parser.add_argument("--vac", action="store_true")
            parser.add_argument("--log-level", default="INFO")
            simulwhisper_args(parser)

            args = parser.parse_args(
                [
                    "--model_path",
                    model_size,
                    "--beams",
                    "5",
                    "--frame_threshold",
                    "25",
                    "--lan",
                    language,
                    "--vac",
                ]
            )
            args.logdir = None

            asr, online_processor = simul_asr_factory(args)

            self._asr = asr
            # Store the class so we can create new sessions from the same ASR
            self._online_class = type(online_processor)
            self._model_size = model_size
            self._language = language
            self._backend = backend
            self._device = device
            self._loaded = True

            logger.info("Model loaded successfully")

    def create_session(self) -> Any:
        """Create a new online session processor for a single transcription session.

        Reuses the already-loaded ASR model — no model re-download.
        Each session gets fresh state via ``SimulWhisperOnline(asr)``.

        Returns:
            A new SimulWhisperOnline processor with clean state.

        Raises:
            RuntimeError: If the engine has not been loaded yet.
        """
        if not self._loaded:
            raise RuntimeError(
                "TranscriptionEngine has not been loaded. Call load() first."
            )

        # SimulWhisperOnline.__init__(asr) creates fresh state from existing model
        return self._online_class(self._asr)
