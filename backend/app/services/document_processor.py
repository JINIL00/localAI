"""
Document Processing Service

Handles:
- File upload and validation
- Text extraction from different file types
- Intelligent chunking for RAG

Designed to easily add more file types in the future.
"""

import os
import hashlib
from datetime import datetime
from typing import List, Tuple, Optional
from pathlib import Path

from pypdf import PdfReader

from app.config import settings


class DocumentProcessor:
    """
    Processes documents for the RAG pipeline.

    Supports: PDF, TXT, MD (easily extensible for DOCX, etc.)
    """

    def __init__(self):
        self.upload_dir = Path(settings.UPLOAD_DIR)
        self.chunk_size = settings.CHUNK_SIZE
        self.chunk_overlap = settings.CHUNK_OVERLAP
        self.allowed_extensions = settings.ALLOWED_EXTENSIONS

    def validate_file(self, filename: str, file_size: int) -> Tuple[bool, str]:
        """
        Validate file before processing.

        Args:
            filename: Name of the file
            file_size: Size in bytes

        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check extension
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext not in self.allowed_extensions:
            return False, f"File type '.{ext}' not supported. Allowed: {', '.join(self.allowed_extensions)}"

        # Check file size
        max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
        if file_size > max_bytes:
            return False, f"File too large. Maximum size: {settings.MAX_FILE_SIZE_MB}MB"

        return True, ""

    def generate_document_id(self, filename: str, content: bytes) -> str:
        """Generate a unique ID for a document based on content hash"""
        hash_input = f"{filename}{len(content)}{content[:1000] if len(content) > 1000 else content}"
        return f"doc_{hashlib.md5(hash_input.encode()).hexdigest()[:12]}"

    async def save_file(self, filename: str, content: bytes) -> str:
        """
        Save uploaded file to disk.

        Returns the file path.
        """
        # Generate unique filename to avoid collisions
        doc_id = self.generate_document_id(filename, content)
        safe_filename = f"{doc_id}_{filename}"
        file_path = self.upload_dir / safe_filename

        with open(file_path, "wb") as f:
            f.write(content)

        return str(file_path)

    def extract_text(self, file_path: str) -> str:
        """
        Extract text content from a file.

        Args:
            file_path: Path to the file

        Returns:
            Extracted text content
        """
        ext = file_path.rsplit(".", 1)[-1].lower()

        if ext == "pdf":
            return self._extract_from_pdf(file_path)
        elif ext in ["txt", "md"]:
            return self._extract_from_text(file_path)
        else:
            raise ValueError(f"Unsupported file type: {ext}")

    def _extract_from_pdf(self, file_path: str) -> str:
        """Extract text from PDF file"""
        reader = PdfReader(file_path)
        text_parts = []

        for page_num, page in enumerate(reader.pages, 1):
            text = page.extract_text()
            if text:
                # Add page marker for citation purposes
                text_parts.append(f"[Page {page_num}]\n{text}")

        return "\n\n".join(text_parts)

    def _extract_from_text(self, file_path: str) -> str:
        """Extract text from TXT/MD file"""
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()

    def chunk_text(self, text: str, doc_id: str) -> List[dict]:
        """
        Split text into overlapping chunks for better retrieval.

        Uses a simple but effective chunking strategy:
        - Fixed size chunks with overlap
        - Tries to break at sentence boundaries

        Args:
            text: The full document text
            doc_id: Document identifier

        Returns:
            List of chunk dictionaries with metadata
        """
        chunks = []
        text = text.strip()

        if not text:
            return chunks

        # Simple sentence-aware chunking
        start = 0
        chunk_index = 0

        while start < len(text):
            # Calculate end position
            end = start + self.chunk_size

            # If not at the end, try to find a good break point
            if end < len(text):
                # Look for sentence endings near the chunk boundary
                for sep in [". ", ".\n", "\n\n", "\n", " "]:
                    last_sep = text.rfind(sep, start + self.chunk_size // 2, end)
                    if last_sep != -1:
                        end = last_sep + len(sep)
                        break

            chunk_text = text[start:end].strip()

            if chunk_text:
                chunks.append({
                    "content": chunk_text,
                    "metadata": {
                        "document_id": doc_id,
                        "chunk_index": chunk_index,
                        "start_char": start,
                        "end_char": end,
                    }
                })
                chunk_index += 1

            # Move start position with overlap
            start = end - self.chunk_overlap
            if start >= len(text) or start < 0:
                break

        return chunks

    async def process_document(self, filename: str, content: bytes) -> dict:
        """
        Full document processing pipeline.

        Args:
            filename: Original filename
            content: File content as bytes

        Returns:
            Document info and chunks
        """
        # Generate document ID
        doc_id = self.generate_document_id(filename, content)

        # Save file
        file_path = await self.save_file(filename, content)

        # Extract text
        text = self.extract_text(file_path)

        if not text.strip():
            raise ValueError("Could not extract any text from the document")

        # Create chunks
        chunks = self.chunk_text(text, doc_id)

        # Prepare document info
        doc_info = {
            "id": doc_id,
            "filename": filename,
            "file_type": filename.rsplit(".", 1)[-1].lower(),
            "size_bytes": len(content),
            "chunk_count": len(chunks),
            "uploaded_at": datetime.utcnow(),
            "file_path": file_path,
        }

        return {
            "document_info": doc_info,
            "chunks": chunks,
            "full_text": text,
        }

    def delete_file(self, file_path: str) -> bool:
        """Delete a document file from disk"""
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                return True
            return False
        except Exception:
            return False
