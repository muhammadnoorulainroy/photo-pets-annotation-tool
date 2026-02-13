import json
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours
    CORS_ORIGINS: str = ""  # comma-separated origins
    SEED_ADMINS: str = "[]"  # JSON array of {username, password, full_name}
    BACKEND_URL: str = "http://localhost:8000"
    
    # Google Drive Service Account credentials
    GOOGLE_SERVICE_ACCOUNT_TYPE: str = "service_account"
    GOOGLE_SERVICE_ACCOUNT_PROJECT_ID: str = ""
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID: str = ""
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: str = ""
    GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL: str = ""
    GOOGLE_SERVICE_ACCOUNT_CLIENT_ID: str = ""
    GOOGLE_DRIVE_FOLDER_ID: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        if not self.CORS_ORIGINS:
            return []
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def seed_admins_list(self) -> list[dict]:
        try:
            return json.loads(self.SEED_ADMINS)
        except json.JSONDecodeError:
            return []

    class Config:
        env_file = ".env"


settings = Settings()
