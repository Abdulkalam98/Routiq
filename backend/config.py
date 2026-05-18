from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    environment: str = "development"
    app_name: str = "Routiq"
    app_url: str = "https://routiq.io"
    api_url: str = "https://api.routiq.io"
    jwt_secret: str = "change-me"

    # Supabase PostgreSQL
    database_url: str = "postgresql+asyncpg://postgres:password@db.supabase.co:5432/postgres"
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # Upstash Redis
    redis_url: str = "rediss://default:token@redis.upstash.io:6379"
    upstash_redis_url: str = ""
    upstash_redis_token: str = ""

    # LLM Providers
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    google_api_key: str = ""
    google_cloud_project: str = ""
    mistral_api_key: str = ""

    # Billing
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""

    # Rates
    usd_to_inr: float = 84.0
    routiq_markup: float = 1.05

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
