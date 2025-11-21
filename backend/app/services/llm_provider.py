"""
LLM Provider - Modular interface for language models.

Designed to easily add support for multiple models in the future.
Currently supports Ollama for local inference.
"""

import httpx
import json
from typing import AsyncGenerator, Optional, List
from abc import ABC, abstractmethod

from app.config import settings


class BaseLLMProvider(ABC):
    """Abstract base class for LLM providers - enables easy swapping of models"""

    @abstractmethod
    async def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """Generate a response from the LLM"""
        pass

    @abstractmethod
    async def generate_stream(
        self, prompt: str, system_prompt: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """Stream a response from the LLM"""
        pass

    @abstractmethod
    async def is_available(self) -> bool:
        """Check if the LLM service is available"""
        pass


class OllamaProvider(BaseLLMProvider):
    """
    Ollama provider for local LLM inference.
    Privacy-first: All processing happens on your machine!
    """

    def __init__(self, model: str = None, base_url: str = None):
        self.model = model or settings.DEFAULT_MODEL
        self.base_url = base_url or settings.OLLAMA_BASE_URL
        self.client = httpx.AsyncClient(timeout=120.0)

    async def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """
        Generate a complete response from Ollama.

        Args:
            prompt: The user's question/prompt
            system_prompt: Optional system instructions

        Returns:
            The generated response text
        """
        messages = []

        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        messages.append({"role": "user", "content": prompt})

        try:
            response = await self.client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": messages,
                    "stream": False,
                },
            )
            response.raise_for_status()
            result = response.json()
            return result["message"]["content"]

        except httpx.HTTPError as e:
            raise ConnectionError(f"Failed to connect to Ollama: {str(e)}")

    async def generate_stream(
        self, prompt: str, system_prompt: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """
        Stream a response from Ollama for better UX on longer responses.

        Yields chunks of text as they're generated.
        """
        messages = []

        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        messages.append({"role": "user", "content": prompt})

        try:
            async with self.client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": messages,
                    "stream": True,
                },
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line:
                        data = json.loads(line)
                        if "message" in data and "content" in data["message"]:
                            yield data["message"]["content"]

        except httpx.HTTPError as e:
            raise ConnectionError(f"Failed to stream from Ollama: {str(e)}")

    async def is_available(self) -> bool:
        """Check if Ollama is running and the model is available"""
        try:
            response = await self.client.get(f"{self.base_url}/api/tags")
            return response.status_code == 200
        except:
            return False

    async def list_models(self) -> List[str]:
        """Get list of available models in Ollama"""
        try:
            response = await self.client.get(f"{self.base_url}/api/tags")
            response.raise_for_status()
            data = response.json()
            return [model["name"] for model in data.get("models", [])]
        except:
            return []

    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()


class LLMProvider:
    """
    Factory class for creating LLM providers.

    Future extensibility: Add more providers here (e.g., LocalAI, vLLM)
    """

    _instance: Optional[OllamaProvider] = None

    @classmethod
    def get_provider(cls, provider_type: str = "ollama", **kwargs) -> BaseLLMProvider:
        """
        Get an LLM provider instance.

        Args:
            provider_type: Type of provider ("ollama" for now, more later)
            **kwargs: Provider-specific configuration

        Returns:
            An LLM provider instance
        """
        if provider_type == "ollama":
            if cls._instance is None:
                cls._instance = OllamaProvider(**kwargs)
            return cls._instance
        else:
            raise ValueError(f"Unknown provider type: {provider_type}")

    @classmethod
    async def cleanup(cls):
        """Cleanup provider resources"""
        if cls._instance:
            await cls._instance.close()
            cls._instance = None
