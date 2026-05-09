from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    upload_dir: str = "uploads"
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours
    redis_url: str = "redis://redis:6379/0"

    class Config:
        env_file = ".env"


settings = Settings()
