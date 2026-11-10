from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://localhost:5432/proyectorenefull"
    entorno: str = "desarrollo"
    min_semanas_entrenamiento: int = 12
    min_semanas_con_unidades: int = 8
    semanas_evaluacion: int = 5

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
