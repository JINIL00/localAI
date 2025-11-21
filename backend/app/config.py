"""
Application configuration settings.
Designed to be modular and easily extensible for future features.
"""

from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    All sensitive data stays local - privacy first!
    """

    # Application settings
    APP_NAME: str = "LocalAI Document Chat"
    DEBUG: bool = False

    # Ollama settings (local LLM)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    DEFAULT_MODEL: str = "llama3.2:3b"

    # Embedding model (runs locally via sentence-transformers)
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

    # Document processing settings
    CHUNK_SIZE: int = 1000  # Characters per chunk
    CHUNK_OVERLAP: int = 200  # Overlap between chunks for context

    # Vector database settings
    CHROMA_PERSIST_DIR: str = "./chroma_db"
    COLLECTION_NAME: str = "documents"

    # Upload settings
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE_MB: int = 50
    ALLOWED_EXTENSIONS: list = ["pdf", "txt", "md"]

    # RAG settings
    TOP_K_RESULTS: int = 4  # Number of relevant chunks to retrieve

    class Config:
        env_file = ".env"
        extra = "allow"


# Global settings instance
settings = Settings()

# Ensure directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
