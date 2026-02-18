"""Tests for app.engine.processor.SessionProcessor."""

from unittest.mock import MagicMock

import numpy as np
import pytest

from app.engine.processor import SessionProcessor


class TestParseResultDict:
    """Test _parse_result with dict inputs (SimulStreaming format)."""

    def test_dict_with_text(self):
        result = {"text": "hello world", "start": 1.0, "end": 2.5}
        parsed = SessionProcessor._parse_result(result)
        assert parsed == [("hello world", 1000.0, 2500.0)]

    def test_dict_empty_text(self):
        result = {"text": "", "start": 0, "end": 0}
        assert SessionProcessor._parse_result(result) == []

    def test_dict_whitespace_text(self):
        result = {"text": "   ", "start": 0, "end": 0}
        assert SessionProcessor._parse_result(result) == []

    def test_empty_dict(self):
        assert SessionProcessor._parse_result({}) == []

    def test_dict_strips_text(self):
        result = {"text": "  hello  ", "start": 0.5, "end": 1.0}
        parsed = SessionProcessor._parse_result(result)
        assert parsed == [("hello", 500.0, 1000.0)]

    def test_dict_missing_start_end_defaults_to_zero(self):
        result = {"text": "word"}
        parsed = SessionProcessor._parse_result(result)
        assert parsed == [("word", 0.0, 0.0)]


class TestParseResultTuple:
    """Test _parse_result with tuple/list inputs (fallback format)."""

    def test_tuple_with_text(self):
        result = (100.0, 200.0, "hello")
        parsed = SessionProcessor._parse_result(result)
        assert parsed == [("hello", 100.0, 200.0)]

    def test_list_with_text(self):
        result = [100.0, 200.0, "hello"]
        parsed = SessionProcessor._parse_result(result)
        assert parsed == [("hello", 100.0, 200.0)]

    def test_tuple_empty_text(self):
        result = (0, 0, "")
        assert SessionProcessor._parse_result(result) == []

    def test_tuple_whitespace_text(self):
        result = (0, 0, "   ")
        assert SessionProcessor._parse_result(result) == []

    def test_short_tuple_ignored(self):
        result = (1.0, 2.0)
        assert SessionProcessor._parse_result(result) == []


class TestParseResultNone:
    """Test _parse_result with None."""

    def test_none_returns_empty(self):
        assert SessionProcessor._parse_result(None) == []


class TestParseResultException:
    """Test _parse_result exception handling (lines 86-87)."""

    def test_dict_with_non_numeric_start_logs_and_returns_empty(self):
        """A dict where float() fails on start should trigger the except branch."""
        result = {"text": "hello", "start": "not-a-number", "end": 1.0}
        assert SessionProcessor._parse_result(result) == []

    def test_tuple_with_non_numeric_values_logs_and_returns_empty(self):
        """A tuple where float() fails should trigger the except branch."""
        result = ("not-a-number", "also-not", "hello")
        assert SessionProcessor._parse_result(result) == []


class TestParseResultUnexpected:
    """Test _parse_result with unexpected types falls through to empty list."""

    def test_int_returns_empty(self):
        assert SessionProcessor._parse_result(42) == []

    def test_string_returns_empty(self):
        assert SessionProcessor._parse_result("unexpected") == []


class TestFeedAudio:
    """Test feed_audio delegates to the online processor."""

    def test_feed_audio_returns_parsed_results(self):
        mock_proc = MagicMock()
        mock_proc.process_iter.return_value = {"text": "hello", "start": 1.0, "end": 2.0}
        session = SessionProcessor(mock_proc)

        audio = np.zeros(1600, dtype=np.float32)
        results = session.feed_audio(audio)

        mock_proc.insert_audio_chunk.assert_called_once_with(audio)
        mock_proc.process_iter.assert_called_once()
        assert results == [("hello", 1000.0, 2000.0)]

    def test_feed_audio_empty_result(self):
        mock_proc = MagicMock()
        mock_proc.process_iter.return_value = {}
        session = SessionProcessor(mock_proc)

        audio = np.zeros(1600, dtype=np.float32)
        results = session.feed_audio(audio)
        assert results == []


class TestFlush:
    """Test flush delegates to finish()."""

    def test_flush_returns_parsed_results(self):
        mock_proc = MagicMock()
        mock_proc.finish.return_value = {"text": "final", "start": 0.0, "end": 3.0}
        session = SessionProcessor(mock_proc)

        results = session.flush()

        mock_proc.finish.assert_called_once()
        assert results == [("final", 0.0, 3000.0)]

    def test_flush_empty_result(self):
        mock_proc = MagicMock()
        mock_proc.finish.return_value = {}
        session = SessionProcessor(mock_proc)

        results = session.flush()
        assert results == []
