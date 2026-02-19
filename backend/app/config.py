"""Application configuration via environment variables with STT_ prefix."""

from pydantic_settings import BaseSettings

MODEL_REPO_MAP: dict[str, str] = {
    "tiny": "mlx-community/whisper-tiny",
    "base": "mlx-community/whisper-base",
    "small": "mlx-community/whisper-small",
    "medium": "mlx-community/whisper-medium",
    "large": "mlx-community/whisper-large-v3",
    "large-v3": "mlx-community/whisper-large-v3",
    "large-v3-turbo": "mlx-community/whisper-large-v3-turbo",
}


def get_model_repo(model_size: str) -> str:
    """Map a short model name to its HuggingFace repo path."""
    try:
        return MODEL_REPO_MAP[model_size]
    except KeyError:
        raise ValueError(
            f"Unknown model size {model_size!r}. "
            f"Valid options: {', '.join(MODEL_REPO_MAP)}"
        )


class Settings(BaseSettings):
    """Settings for the STT Local backend.

    All settings can be overridden via environment variables
    prefixed with STT_, e.g. STT_MODEL_SIZE=base, STT_LANGUAGE=en.
    """

    host: str = "0.0.0.0"
    port: int = 8765
    model_size: str = "large-v3-turbo"
    language: str = "cs"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:4173",
    ]
    log_level: str = "info"

    model_config = {"env_prefix": "STT_"}


settings = Settings()
