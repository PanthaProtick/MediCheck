from pathlib import Path
from typing import List, Literal, Union
from urllib.parse import urlsplit
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
DEFAULT_DB_PATH = str(DEFAULT_DATA_DIR / "demo.sqlite3")

class Settings(BaseSettings):
    PROJECT_NAME: str = "Availability Verification MVP"
    ENV: str = "development"
    APP_MODE: Literal["local", "hosted"] = "local"
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

    # Rate limiting & body size bounds (P08 policy)
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_MAX_REQUESTS: int = 120
    RATE_LIMIT_MAX_MUTATIONS: int = 30
    MAX_REQUEST_BODY_BYTES: int = 16384  # 16 KiB

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

    def validate_hosted(self) -> None:
        if self.APP_MODE != "hosted":
            if self.ENV == "production":
                raise RuntimeError("Production requires APP_MODE=hosted.")
            return
        url = self.get_sync_database_url()
        try:
            is_postgres = bool(url) and make_url(url).get_backend_name() == "postgresql"
        except ArgumentError:
            is_postgres = False
        if not is_postgres:
            raise RuntimeError("Hosted mode requires a PostgreSQL DATABASE_URL.")
        for label, value in (("CLERK_ISSUER", self.CLERK_ISSUER),
                             ("PUBLIC_APP_ORIGIN", self.PUBLIC_APP_ORIGIN)):
            parts = urlsplit(value)
            if parts.scheme != "https" or not parts.hostname or parts.username or parts.password or parts.query or parts.fragment or parts.path != "":
                raise RuntimeError(label + " must be an HTTPS origin without a path.")
        if not self.CLERK_PUBLISHABLE_KEY.startswith(("pk_test_", "pk_live_")):
            raise RuntimeError("Hosted mode requires CLERK_PUBLISHABLE_KEY.")
        if self.ENV == "production" and not self.CLERK_PUBLISHABLE_KEY.startswith("pk_live_"):
            raise RuntimeError("Production requires a Clerk production publishable key.")
        if not isinstance(self.CORS_ORIGINS, list) or self.PUBLIC_APP_ORIGIN not in self.CORS_ORIGINS or "*" in self.CORS_ORIGINS:
            raise RuntimeError("Hosted CORS_ORIGINS must explicitly include PUBLIC_APP_ORIGIN.")

    def get_sync_database_url(self, is_test: bool = False) -> str:
        url = self.TEST_DATABASE_URL if is_test else self.DATABASE_URL
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

