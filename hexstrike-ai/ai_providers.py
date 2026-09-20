#!/usr/bin/env python3
"""
HexStrike AI - AI Provider Integration

Provides AI query capabilities through the HexStrike AI provider.
"""

import os
import asyncio
import aiohttp
import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class AIResponse:
    """Response from an AI provider"""
    provider: str
    model: str
    response: str
    success: bool
    error: Optional[str] = None
    tokens_used: Optional[int] = None
    response_time: Optional[float] = None


class HexStrikeAIProvider:
    """HexStrike AI provider"""

    def __init__(self, api_key: Optional[str] = None, model: str = "hexstrike-v6"):
        self.api_key = api_key or os.environ.get("HEXSTRIKE_API_KEY")
        self._model = model
        self.base_url = os.environ.get("HEXSTRIKE_AI_URL", "http://127.0.0.1:8888")

    @property
    def name(self) -> str:
        return "HexStrike"

    @property
    def model(self) -> str:
        return self._model

    async def query(self, question: str, context: Optional[str] = None) -> AIResponse:
        import time
        start_time = time.time()

        # Build the request payload
        payload = {
            "question": question,
            "context": context,
            "model": self._model
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/api/ai/query",
                    headers={
                        "Content-Type": "application/json",
                        "X-API-Key": self.api_key or ""
                    },
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=120)
                ) as resp:
                    data = await resp.json()

                    if resp.status != 200:
                        return AIResponse(
                            provider=self.name,
                            model=self.model,
                            response="",
                            success=False,
                            error=data.get("error", f"HTTP {resp.status}")
                        )

                    response_text = data.get("response", "")
                    tokens = data.get("tokens_used")

                    return AIResponse(
                        provider=self.name,
                        model=self.model,
                        response=response_text,
                        success=True,
                        tokens_used=tokens,
                        response_time=time.time() - start_time
                    )

        except asyncio.TimeoutError:
            return AIResponse(
                provider=self.name,
                model=self.model,
                response="",
                success=False,
                error="Request timed out"
            )
        except aiohttp.ClientConnectorError:
            return AIResponse(
                provider=self.name,
                model=self.model,
                response="",
                success=False,
                error="Could not connect to HexStrike AI server"
            )
        except Exception as e:
            return AIResponse(
                provider=self.name,
                model=self.model,
                response="",
                success=False,
                error=str(e)
            )


class AIManager:
    """Manager for querying the HexStrike AI provider"""

    def __init__(self):
        self.provider = HexStrikeAIProvider()

    async def query(
        self,
        question: str,
        context: Optional[str] = None
    ) -> AIResponse:
        """Query the HexStrike AI provider"""
        return await self.provider.query(question, context)

    def format_response(self, response: AIResponse) -> str:
        """Format AI response for display"""
        output = f"{'═' * 70}\n"
        output += f"🤖 {response.provider.upper()} ({response.model})\n"
        output += f"{'═' * 70}\n\n"

        if response.success:
            output += response.response
            if response.response_time:
                output += f"\n\n⏱️  Response time: {response.response_time:.2f}s"
            if response.tokens_used:
                output += f" | 📊 Tokens: {response.tokens_used}"
        else:
            output += f"❌ Error: {response.error}"

        return output


# Global instance for easy access
_ai_manager: Optional[AIManager] = None


def get_ai_manager() -> AIManager:
    """Get or create the global AIManager instance"""
    global _ai_manager
    if _ai_manager is None:
        _ai_manager = AIManager()
    return _ai_manager


# Synchronous wrapper for non-async contexts
def query_hexstrike_ai_sync(
    question: str,
    context: Optional[str] = None
) -> Dict[str, Any]:
    """Synchronous wrapper to query HexStrike AI"""
    manager = get_ai_manager()

    # Run async function in event loop
    loop = asyncio.new_event_loop()
    try:
        response = loop.run_until_complete(
            manager.query(question, context)
        )
    finally:
        loop.close()

    # Convert to dict format
    return {
        "provider": response.provider,
        "model": response.model,
        "response": response.response,
        "success": response.success,
        "error": response.error,
        "tokens_used": response.tokens_used,
        "response_time": response.response_time
    }
