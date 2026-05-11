from functools import lru_cache
from typing import List
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    PROJECT_NAME: str = "SelfMind Pro API"
    API_V1_STR: str = "/api/v1"

    # Cloud providers usually expose one connection string (DATABASE_URL).
    # Local development can still use separate POSTGRES_* variables.
    DATABASE_URL: str | None = None
    DB_SSL_MODE: str | None = None

    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "selfmind_db"

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-5-mini"
    BACKEND_CORS_ORIGINS: List[str] = ["*"]

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        raw_url = self.DATABASE_URL or (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )
        return self._normalize_database_url(raw_url)

    def _normalize_database_url(self, raw_url: str) -> str:
        url = raw_url.strip()
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)

        if self.DB_SSL_MODE and "sslmode=" not in url:
            parsed = urlsplit(url)
            query = dict(parse_qsl(parsed.query, keep_blank_values=True))
            query["sslmode"] = self.DB_SSL_MODE
            url = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query), parsed.fragment))

        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
