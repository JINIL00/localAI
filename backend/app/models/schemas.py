"""
Pydantic schemas for API request/response models.
These define the contract between frontend and backend.
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum


class MessageRole(str, Enum):
    """Chat message roles"""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class DocumentInfo(BaseModel):
    """Information about an uploaded document"""
    id: str
    filename: str
    file_type: str
    size_bytes: int
    chunk_count: int
    uploaded_at: datetime

    class Config:
        json_schema_extra = {
            "example": {
                "id": "doc_abc123",
                "filename": "research_paper.pdf",
                "file_type": "pdf",
                "size_bytes": 1024000,
                "chunk_count": 45,
                "uploaded_at": "2024-01-15T10:30:00Z"
            }
        }


class DocumentUploadResponse(BaseModel):
    """Response after uploading a document"""
    success: bool
    message: str
    document: Optional[DocumentInfo] = None


class SourceDocument(BaseModel):
    """A source chunk that was used to generate an answer"""
    content: str
    document_id: str
    document_name: str
    chunk_index: int
    relevance_score: float = Field(ge=0, le=1)


class ChatMessage(BaseModel):
    """A single chat message"""
    role: MessageRole
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    sources: Optional[List[SourceDocument]] = None


class ChatRequest(BaseModel):
    """Request to chat with documents"""
    message: str = Field(min_length=1, max_length=4000)
    conversation_history: List[ChatMessage] = []

    class Config:
        json_schema_extra = {
            "example": {
                "message": "What are the main findings of the research?",
                "conversation_history": []
            }
        }


class ChatResponse(BaseModel):
    """Response from the chat endpoint"""
    response: str
    sources: List[SourceDocument]
    model_used: str
    processing_time_ms: int


class ModelInfo(BaseModel):
    """Information about an available LLM model"""
    name: str
    size: str
    description: str
    is_available: bool


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    ollama_connected: bool
    documents_count: int
    available_models: List[str]
