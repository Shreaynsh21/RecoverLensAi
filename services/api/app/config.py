from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    app_name: str = "RecoverLens API"
    app_env: str = "development"
    debug: bool = False

    mysql_user: str = "recoverlens_app"
    mysql_password: str
    mysql_host: str = "localhost"
    mysql_port: int = 3306
    mysql_database: str = "recoverlens"

    cors_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def allowed_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]


settings = Settings()