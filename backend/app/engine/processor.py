"""Per-session audio processor wrapping SimulStreaming's OnlineProcessor."""

import logging
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

# Type alias for transcription result tuples: (text, start_ms, end_ms)
ResultTuple = tuple[str, float, float]


class SessionProcessor:
    """Wraps a SimulStreaming online processor for a single transcription session.

    Each WebSocket connection should create its own SessionProcessor via
    ``TranscriptionEngine.create_session()`` and wrap it here.

    SimulStreaming's process_iter() returns a dict:
        {'start': float_seconds, 'end': float_seconds, 'text': str, ...}
    or an empty dict {} when there's nothing to emit.
    """

    def __init__(self, online_processor: Any) -> None:
        self._processor = online_processor

    def feed_audio(self, audio: np.ndarray) -> list[ResultTuple]:
        """Feed an audio chunk and return any partial results available.

        Args:
            audio: Float32 numpy array of audio samples (16 kHz mono).

        Returns:
            List of (text, start_ms, end_ms) tuples for partial results.
        """
        self._processor.insert_audio_chunk(audio)
        result = self._processor.process_iter()
        return self._parse_result(result)

    def flush(self) -> list[ResultTuple]:
        """Flush remaining audio and return final results.

        Calls finish() which sets is_last=True and processes remaining audio.

        Returns:
            List of (text, start_ms, end_ms) tuples for final results.
        """
        result = self._processor.finish()
        return self._parse_result(result)

    @staticmethod
    def _parse_result(result: Any) -> list[ResultTuple]:
        """Parse a result from SimulStreaming into our tuple format.

        SimulStreaming's process_iter() returns:
        - {} (empty dict) when nothing to emit
        - {'start': seconds, 'end': seconds, 'text': str, ...} with a result

        Args:
            result: Raw result from the online processor.

        Returns:
            List of (text, start_ms, end_ms) tuples.
        """
        if result is None:
            return []

        try:
            # Dict result from SimulStreaming
            if isinstance(result, dict):
                text = result.get("text", "")
                if not text or not str(text).strip():
                    return []
                start_s = float(result.get("start", 0))
                end_s = float(result.get("end", 0))
                return [(str(text).strip(), start_s * 1000, end_s * 1000)]

            # Tuple/list fallback: (start, end, text)
            if isinstance(result, (tuple, list)) and len(result) >= 3:
                start_ms, end_ms, text = result[0], result[1], result[2]
                if text and str(text).strip():
                    return [(str(text).strip(), float(start_ms), float(end_ms))]
                return []

        except Exception:
            logger.exception("Failed to parse transcription result: %r", result)

        return []
