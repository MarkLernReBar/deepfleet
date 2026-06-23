"""Resolve a DeepFleet ``provider:model`` string into a LangChain chat model.

DeepFleet sends models like ``anthropic:claude-sonnet-4-6`` or ``openai:gpt-5``.
By default we hand that string straight to deepagents, which uses
``langchain.chat_models.init_chat_model`` and the matching provider SDK + API key
from the environment (``ANTHROPIC_API_KEY`` / ``OPENAI_API_KEY`` / ``GOOGLE_API_KEY``).

For self-hosters who route everything through a single OpenAI-compatible gateway
(e.g. an internal proxy, LiteLLM, or the Manus forge gateway), set:

    DEEPFLEET_OPENAI_BASE_URL=https://your-gateway/v1
    DEEPFLEET_OPENAI_API_KEY=sk-...

When that is set, every model is created as a ``ChatOpenAI`` pointed at the gateway,
using just the bare model id (the provider prefix is stripped).
"""

from __future__ import annotations

import os
from typing import Any


def strip_provider(model: str) -> str:
    return model.split(":", 1)[1] if ":" in model else model


def resolve_model(model: str) -> Any:
    """Return either the model string (default) or a configured ChatOpenAI client.

    deepagents accepts both a string and a BaseChatModel instance for ``model``.
    """
    base_url = os.environ.get("DEEPFLEET_OPENAI_BASE_URL")
    if base_url:
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=strip_provider(model),
            base_url=base_url,
            api_key=os.environ.get("DEEPFLEET_OPENAI_API_KEY", "not-needed"),
            temperature=0,
        )
    # Default: let deepagents/init_chat_model handle the provider:model string.
    return model
