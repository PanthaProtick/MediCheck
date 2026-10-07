from pathlib import Path
from typing import List, Union
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
DEFAULT_DB_PATH = str(DEFAULT_DATA_DIR / "demo.sqlite3")

class Settings(BaseSettings):
    PROJECT_NAME: str = "Availability Verification MVP"
    ENV: str = "development"
    DEBUG: bool = False
    API_PREFIX: str = "/api/v1"
    API_V2_PREFIX: str = "/api/v2"

    DEMO_DATABASE_PATH: str = Field(default=DEFAULT_DB_PATH)
    DEMO_STAFF_TOKEN: str = Field(default="")

    # PostgreSQL / Neon settings
    DATABASE_URL: str = Field(default="")
    TEST_DATABASE_URL: str = Field(default="")
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 0
    DB_POOL_TIMEOUT: float = 2.0

    # Clerk Auth settings
    CLERK_PUBLISHABLE_KEY: str = Field(default="")
    CLERK_SECRET_KEY: str = Field(default="")
    CLERK_ISSUER: str = Field(default="")
    PUBLIC_APP_ORIGIN: str = Field(default="http://localhost:5173")

    STATIC_DIR: str | None = None
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def get_sync_database_url(self, is_test: bool = False) -> str:
        url = self.TEST_DATABASE_URL if is_test and self.TEST_DATABASE_URL else self.DATABASE_URL
        if not url:
            return ""
        # Normalize postgres driver for SQLAlchemy sync engine
        if url.startswith("postgresql+asyncpg://"):
            return url.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+psycopg://", 1)
        if url.startswith("postgresql://") and not url.startswith("postgresql+"):
            return url.replace("postgresql://", "postgresql+psycopg://", 1)
        return url

settings = Settings()

