"""Audio format conversion utilities."""

import numpy as np


def pcm_to_float32(data: bytes) -> np.ndarray:
    """Convert raw PCM int16 little-endian bytes to a float32 numpy array.

    The input is expected to be 16-bit signed integer PCM samples in
    little-endian byte order (S16_LE), which is the standard format
    sent by browser MediaRecorder / AudioWorklet.

    Args:
        data: Raw PCM bytes (int16, little-endian).

    Returns:
        Numpy float32 array with values in the range [-1.0, 1.0].
    """
    samples = np.frombuffer(data, dtype=np.int16).astype(np.float32)
    return samples / 32768.0
