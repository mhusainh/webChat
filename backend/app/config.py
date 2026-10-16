from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8')

    database_url: str
    secret_key: str = 'dev-secret-change-me'
    algorithm: str = 'HS256'
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7
    seed_username: str = 'admin'
    seed_password: str = 'admin123'
    n8n_webhook_url: str = ''


settings = Settings()
