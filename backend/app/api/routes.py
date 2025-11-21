"""
API Routes for the Document Chat Application

Endpoints:
- POST /documents/upload - Upload a document
- GET /documents - List all documents
- DELETE /documents/{doc_id} - Remove a document
- POST /chat - Chat with your documents
- GET /health - Health check
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from typing import List

from app.models.schemas import (
    DocumentUploadResponse,
    DocumentInfo,
    ChatRequest,
    ChatResponse,
    HealthResponse,
)
from app.services.document_processor import DocumentProcessor
from app.services.rag_service import rag_service
from app.services.llm_provider import LLMProvider
from app.config import settings

router = APIRouter()
doc_processor = DocumentProcessor()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint.

    Returns system status, Ollama connection, and document count.
    """
    llm = LLMProvider.get_provider("ollama")
    ollama_connected = await llm.is_available()
    models = await llm.list_models() if ollama_connected else []

    return HealthResponse(
        status="healthy",
        ollama_connected=ollama_connected,
        documents_count=rag_service.get_document_count(),
        available_models=models
    )


@router.post("/documents/upload", response_model=DocumentUploadResponse)
async def upload_document(file: UploadFile = File(...)):
    """
    Upload and process a document.

    Supports: PDF, TXT, MD files
    Maximum size: 50MB (configurable)

    The document will be:
    1. Validated
    2. Text extracted
    3. Chunked for efficient retrieval
    4. Embedded and stored in the vector database
    """
    try:
        # Read file content
        content = await file.read()

        # Validate file
        is_valid, error_msg = doc_processor.validate_file(file.filename, len(content))
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)

        # Process document (extract text, chunk, etc.)
        result = await doc_processor.process_document(file.filename, content)

        # Add to vector store
        await rag_service.add_document(
            result["document_info"],
            result["chunks"]
        )

        return DocumentUploadResponse(
            success=True,
            message=f"Successfully processed '{file.filename}' into {result['document_info']['chunk_count']} searchable chunks",
            document=DocumentInfo(**result["document_info"])
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing document: {str(e)}"
        )


@router.get("/documents", response_model=List[DocumentInfo])
async def list_documents():
    """
    Get a list of all uploaded documents.

    Returns document metadata including filename, size, and chunk count.
    """
    documents = rag_service.get_documents()
    return [DocumentInfo(**doc) for doc in documents]


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    """
    Remove a document from the system.

    This removes the document from:
    - Vector database
    - Local file storage
    """
    # Get document info first
    documents = rag_service.get_documents()
    doc_info = next((d for d in documents if d["id"] == doc_id), None)

    if not doc_info:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove from vector store
    success = await rag_service.remove_document(doc_id)

    if not success:
        raise HTTPException(
            status_code=500,
            detail="Failed to remove document from vector store"
        )

    # Remove file from disk
    if "file_path" in doc_info:
        doc_processor.delete_file(doc_info["file_path"])

    return {"success": True, "message": f"Document '{doc_info['filename']}' removed"}


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Chat with your documents using RAG.

    The system will:
    1. Find relevant chunks from your documents
    2. Use them as context for the LLM
    3. Generate an accurate, sourced answer

    Returns the response along with source citations.
    """
    # Check if Ollama is available
    llm = LLMProvider.get_provider("ollama")
    if not await llm.is_available():
        raise HTTPException(
            status_code=503,
            detail="Ollama is not running. Please start Ollama with: ollama serve"
        )

    try:
        result = await rag_service.chat(
            query=request.message,
            conversation_history=request.conversation_history
        )

        return ChatResponse(
            response=result["response"],
            sources=result["sources"],
            model_used=result["model_used"],
            processing_time_ms=result["processing_time_ms"]
        )

    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating response: {str(e)}"
        )


@router.get("/models")
async def list_models():
    """
    Get list of available LLM models from Ollama.

    Future: Will support multiple model providers.
    """
    llm = LLMProvider.get_provider("ollama")
    models = await llm.list_models()

    return {
        "models": models,
        "current_model": settings.DEFAULT_MODEL
    }
