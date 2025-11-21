"""
RAG (Retrieval Augmented Generation) Service

The core intelligence of the document chat system:
1. Creates embeddings for document chunks
2. Stores them in a vector database
3. Retrieves relevant context for questions
4. Generates answers using the LLM

All processing happens locally - your data never leaves your machine!
"""

import time
from typing import List, Optional
from datetime import datetime

import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer

from app.config import settings
from app.models.schemas import SourceDocument, ChatMessage
from app.services.llm_provider import LLMProvider


class RAGService:
    """
    Retrieval Augmented Generation service.

    Combines vector search with LLM generation for accurate,
    context-aware answers about your documents.
    """

    def __init__(self):
        # Initialize embedding model (runs locally)
        self.embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL)

        # Initialize ChromaDB for vector storage
        self.chroma_client = chromadb.PersistentClient(
            path=settings.CHROMA_PERSIST_DIR,
            settings=ChromaSettings(anonymized_telemetry=False)
        )

        # Get or create the documents collection
        self.collection = self.chroma_client.get_or_create_collection(
            name=settings.COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"}  # Use cosine similarity
        )

        # Document metadata storage (in production, use a proper DB)
        self._documents: dict = {}

        # LLM provider
        self.llm = LLMProvider.get_provider("ollama")

    def _create_embedding(self, text: str) -> List[float]:
        """Create embedding vector for text"""
        return self.embedding_model.encode(text).tolist()

    async def add_document(self, doc_info: dict, chunks: List[dict]) -> None:
        """
        Add a document and its chunks to the vector store.

        Args:
            doc_info: Document metadata
            chunks: List of text chunks with metadata
        """
        if not chunks:
            return

        # Store document metadata
        self._documents[doc_info["id"]] = doc_info

        # Prepare data for ChromaDB
        ids = []
        documents = []
        metadatas = []
        embeddings = []

        for chunk in chunks:
            chunk_id = f"{doc_info['id']}_{chunk['metadata']['chunk_index']}"
            ids.append(chunk_id)
            documents.append(chunk["content"])
            metadatas.append({
                **chunk["metadata"],
                "document_name": doc_info["filename"]
            })
            embeddings.append(self._create_embedding(chunk["content"]))

        # Add to collection
        self.collection.add(
            ids=ids,
            documents=documents,
            metadatas=metadatas,
            embeddings=embeddings
        )

    async def remove_document(self, doc_id: str) -> bool:
        """
        Remove a document and all its chunks from the vector store.

        Args:
            doc_id: Document ID to remove

        Returns:
            True if successful
        """
        try:
            # Get all chunk IDs for this document
            results = self.collection.get(
                where={"document_id": doc_id}
            )

            if results["ids"]:
                self.collection.delete(ids=results["ids"])

            # Remove from metadata storage
            if doc_id in self._documents:
                del self._documents[doc_id]

            return True
        except Exception as e:
            print(f"Error removing document: {e}")
            return False

    async def retrieve_context(
        self, query: str, top_k: int = None
    ) -> List[SourceDocument]:
        """
        Retrieve relevant document chunks for a query.

        Uses semantic similarity to find the most relevant context.

        Args:
            query: The user's question
            top_k: Number of results to return

        Returns:
            List of relevant source documents
        """
        if top_k is None:
            top_k = settings.TOP_K_RESULTS

        # Create query embedding
        query_embedding = self._create_embedding(query)

        # Search vector store
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"]
        )

        # Convert to SourceDocument objects
        sources = []
        if results["documents"] and results["documents"][0]:
            for i, doc in enumerate(results["documents"][0]):
                metadata = results["metadatas"][0][i]
                distance = results["distances"][0][i]

                # Convert distance to relevance score (cosine distance to similarity)
                relevance = 1 - distance

                sources.append(SourceDocument(
                    content=doc,
                    document_id=metadata["document_id"],
                    document_name=metadata["document_name"],
                    chunk_index=metadata["chunk_index"],
                    relevance_score=round(relevance, 3)
                ))

        return sources

    def _build_prompt(
        self,
        query: str,
        context: List[SourceDocument],
        conversation_history: List[ChatMessage]
    ) -> tuple[str, str]:
        """
        Build the prompt for the LLM.

        Returns (system_prompt, user_prompt)
        """
        system_prompt = """You are a helpful AI assistant that answers questions based on the provided document context.

Rules:
1. Only answer based on the provided context
2. If the context doesn't contain enough information, say so clearly
3. Be concise but thorough
4. When referencing information, mention which document it came from
5. If asked about something not in the documents, politely explain you can only answer about the uploaded documents"""

        # Build context string
        context_str = "\n\n---\n\n".join([
            f"From '{source.document_name}' (relevance: {source.relevance_score:.0%}):\n{source.content}"
            for source in context
        ])

        # Build conversation history string
        history_str = ""
        if conversation_history:
            history_str = "\n\nPrevious conversation:\n"
            for msg in conversation_history[-6:]:  # Last 6 messages for context
                role = "User" if msg.role == "user" else "Assistant"
                history_str += f"{role}: {msg.content}\n"

        user_prompt = f"""Context from documents:
{context_str}
{history_str}
Current question: {query}

Please provide a helpful answer based on the document context above."""

        return system_prompt, user_prompt

    async def chat(
        self,
        query: str,
        conversation_history: List[ChatMessage] = None
    ) -> dict:
        """
        Main chat function - retrieves context and generates an answer.

        Args:
            query: The user's question
            conversation_history: Previous messages for context

        Returns:
            Response with answer and sources
        """
        start_time = time.time()

        if conversation_history is None:
            conversation_history = []

        # Check if we have any documents
        if self.collection.count() == 0:
            return {
                "response": "I don't have any documents to search through yet. Please upload some documents first, and then I'll be happy to answer your questions about them!",
                "sources": [],
                "model_used": settings.DEFAULT_MODEL,
                "processing_time_ms": int((time.time() - start_time) * 1000)
            }

        # Retrieve relevant context
        sources = await self.retrieve_context(query)

        if not sources:
            return {
                "response": "I couldn't find any relevant information in the uploaded documents for your question. Try rephrasing your question or uploading more relevant documents.",
                "sources": [],
                "model_used": settings.DEFAULT_MODEL,
                "processing_time_ms": int((time.time() - start_time) * 1000)
            }

        # Build prompt
        system_prompt, user_prompt = self._build_prompt(
            query, sources, conversation_history
        )

        # Generate response using LLM
        response = await self.llm.generate(user_prompt, system_prompt)

        processing_time = int((time.time() - start_time) * 1000)

        return {
            "response": response,
            "sources": sources,
            "model_used": settings.DEFAULT_MODEL,
            "processing_time_ms": processing_time
        }

    def get_documents(self) -> List[dict]:
        """Get list of all uploaded documents"""
        return list(self._documents.values())

    def get_document_count(self) -> int:
        """Get total number of documents"""
        return len(self._documents)

    def get_chunk_count(self) -> int:
        """Get total number of chunks in vector store"""
        return self.collection.count()


# Global RAG service instance
rag_service = RAGService()
