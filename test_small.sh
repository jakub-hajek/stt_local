#!/usr/bin/env bash
# Test SimulStreaming with the small model (better quality than tiny).
# Usage:
#   ./test_small.sh              # Czech, mic
#   ./test_small.sh en           # English, mic
#   ./test_small.sh cs file.wav  # Czech, file
export MODEL=small
exec "$(dirname "$0")/test_tiny.sh" "$@"
