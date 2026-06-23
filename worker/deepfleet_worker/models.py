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

Workspace-registered custom models: when ``custom_model_config`` is present on the
AgentSpec (``base_url``, ``api_key_env``, ``model_id``), we create a ``ChatOpenAI``
client for that endpoint. Agents using ``custom:…`` without registry metadata still
use ``resolve_model`` defaults — the built-in web orchestrator resolves registry rows
server-side; unregistered custom ids pass through as-is.
"""

from __future__ import annotations

import os
from typing import Any


def strip_provider(model: str) -> str:
    return model.split(":", 1)[1] if ":" in model else model


def resolve_model(model: str, custom_model_config: dict[str, str] | None = None) -> Any:
    """Return either the model string (default) or a configured ChatOpenAI client.

    deepagents accepts both a string and a BaseChatModel instance for ``model``.
    """
    if custom_model_config:
        from langchain_openai import ChatOpenAI

        api_key_env = custom_model_config.get("api_key_env", "")
        return ChatOpenAI(
            model=custom_model_config.get("model_id") or strip_provider(model),
            base_url=custom_model_config.get("base_url"),
            api_key=os.environ.get(api_key_env, "not-needed") if api_key_env else "not-needed",
            temperature=0,
        )

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
