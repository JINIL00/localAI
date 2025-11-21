"""
LocalAI Document Chat - Main Application

A privacy-first document chat assistant that runs entirely on your machine.
No data ever leaves your computer!

Author: Your Name
License: MIT
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api import router
from app.config import settings
from app.services.llm_provider import LLMProvider


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifecycle manager.

    Handles startup and shutdown tasks.
    """
    # Startup
    print(f"🚀 Starting {settings.APP_NAME}")
    print(f"📁 Upload directory: {settings.UPLOAD_DIR}")
    print(f"🗄️  Vector DB: {settings.CHROMA_PERSIST_DIR}")
    print(f"🤖 Default model: {settings.DEFAULT_MODEL}")

    yield

    # Shutdown
    print("👋 Shutting down...")
    await LLMProvider.cleanup()


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    description="""
    A privacy-first document chat assistant powered by local LLMs.

    ## Features
    - Upload PDFs and text files
    - Ask questions about your documents
    - All processing happens locally
    - Citations show where answers come from

    ## Privacy
    Your documents never leave your machine. All AI processing
    is done locally using Ollama.
    """,
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router, prefix="/api")


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "name": settings.APP_NAME,
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
