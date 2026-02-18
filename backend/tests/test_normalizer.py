"""Tests for app.audio.normalizer.pcm_to_float32()."""

import struct

import numpy as np

from app.audio.normalizer import pcm_to_float32


class TestPcmToFloat32:
    """Verify PCM int16 -> float32 conversion."""

    def test_silence(self):
        """All-zero bytes should produce all-zero floats."""
        data = b"\x00\x00" * 100
        result = pcm_to_float32(data)
        assert result.dtype == np.float32
        assert len(result) == 100
        np.testing.assert_array_equal(result, np.zeros(100, dtype=np.float32))

    def test_max_positive(self):
        """int16 max (32767) should map close to 1.0."""
        data = struct.pack("<h", 32767)
        result = pcm_to_float32(data)
        assert len(result) == 1
        assert abs(result[0] - (32767.0 / 32768.0)) < 1e-6

    def test_max_negative(self):
        """int16 min (-32768) should map to -1.0."""
        data = struct.pack("<h", -32768)
        result = pcm_to_float32(data)
        assert len(result) == 1
        assert result[0] == -1.0

    def test_known_values(self):
        """Test a sequence of known int16 values."""
        values = [0, 16384, -16384, 32767, -32768]
        data = struct.pack(f"<{len(values)}h", *values)
        result = pcm_to_float32(data)
        expected = np.array(values, dtype=np.float32) / 32768.0
        np.testing.assert_allclose(result, expected, atol=1e-6)

    def test_output_range(self):
        """Output values must be in [-1.0, 1.0]."""
        # Random-ish int16 bytes
        rng = np.random.default_rng(42)
        samples = rng.integers(-32768, 32767, size=1000, dtype=np.int16)
        data = samples.tobytes()
        result = pcm_to_float32(data)
        assert np.all(result >= -1.0)
        assert np.all(result <= 1.0)

    def test_empty_input(self):
        """Empty bytes should produce an empty array."""
        result = pcm_to_float32(b"")
        assert len(result) == 0
        assert result.dtype == np.float32
