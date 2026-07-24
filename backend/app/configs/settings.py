from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # App
    APP_ENV: str = "development"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    CORS_ORIGINS: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    # MongoDB
    MONGO_URI: str
    MONGO_DB_NAME: str

    # GROQ
    GROQ_MODEL: Optional [str] = None
    GROQ_API_KEY: Optional[str] = None

    # CLAUDE
    CLAUDE_API_KEY: Optional[str] = None
    CLAUDE_MODEL: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )


settings = Settings()
