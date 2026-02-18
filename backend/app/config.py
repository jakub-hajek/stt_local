"""Application configuration via environment variables with STT_ prefix."""

from pydantic_settings import BaseSettings


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
