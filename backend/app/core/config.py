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

    DEMO_DATABASE_PATH: str = Field(default=DEFAULT_DB_PATH)
    DEMO_STAFF_TOKEN: str = Field(default="")
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

settings = Settings()
