"""Translate deepagents/LangGraph stream events into DeepFleet step events.

DeepFleet's trace viewer understands exactly five step types (mirroring the
``STEP_TYPES`` constant in ``shared/catalog.ts``):

    plan | tool_call | tool_result | subagent | message

This module runs a compiled deepagents agent with ``astream_events`` and maps the
raw LangGraph events onto those five step types, yielding dicts that the FastAPI
layer serialises as Server-Sent Events.
"""

from __future__ import annotations

import json
from typing import Any, AsyncIterator

# Tool names that the deepagents harness uses internally for planning / delegation.
_PLAN_TOOLS = {"write_todos", "write_todo", "plan"}
_SUBAGENT_TOOLS = {"task", "Task"}


def _as_text(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                parts.append(block.get("text") or block.get("content") or "")
            else:
                parts.append(str(block))
        return "".join(parts)
    return str(content)


def _safe_json(obj: Any) -> str:
    try:
        return json.dumps(obj, default=str)
    except Exception:  # noqa: BLE001
        return str(obj)


def _extract_tool_output(output: Any) -> str:
    """Best-effort extraction of readable text from a tool's return value.

    Handles plain strings, ToolMessage objects, and LangGraph ``Command`` objects
    (used by the harness Task tool) whose update contains ToolMessages.
    """
    # LangGraph Command object: dig into .update['messages'][-1].content
    update = getattr(output, "update", None)
    if isinstance(update, dict):
        msgs = update.get("messages")
        if isinstance(msgs, list) and msgs:
            last = msgs[-1]
            content = getattr(last, "content", None)
            if content is not None:
                return _as_text(content)
    # ToolMessage / AIMessage-like
    content = getattr(output, "content", None)
    if content is not None:
        return _as_text(content)
    return _as_text(output)


def _current_langsmith_run_id() -> str | None:
    try:
        from langsmith.run_helpers import get_current_run_tree

        tree = get_current_run_tree()
        if tree and tree.id:
            return str(tree.id)
    except Exception:  # noqa: BLE001
        pass
    return None


async def stream_agent_events(agent, user_input: str) -> AsyncIterator[dict[str, Any]]:
    """Run the agent and yield DeepFleet step events as dicts.

    Each yielded dict has the shape ``{"type": <step_type>, "content": {...}}``.
    A final ``{"type": "message", ...}`` carries the agent's answer.
    """
    inputs = {"messages": [{"role": "user", "content": user_input}]}
    final_message = ""
    seen_tool_calls: dict[str, dict] = {}

    async for ev in agent.astream_events(inputs, version="v2"):
        kind = ev.get("event")
        name = ev.get("name", "")
        data = ev.get("data", {})

        # --- planning: the harness writes a todo list via write_todos ---
        if kind == "on_tool_start" and name in _PLAN_TOOLS:
            tool_input = data.get("input", {})
            todos = tool_input.get("todos") or tool_input.get("todo") or tool_input
            yield {"type": "plan", "content": {"plan": _as_text(_safe_json(todos)), "raw": todos}}
            continue

        # --- subagent delegation via the Task tool ---
        if kind == "on_tool_start" and name in _SUBAGENT_TOOLS:
            tool_input = data.get("input", {})
            yield {
                "type": "subagent",
                "content": {
                    "name": tool_input.get("subagent_type") or tool_input.get("name") or "subagent",
                    "input": _as_text(tool_input.get("description") or _safe_json(tool_input)),
                },
            }
            continue

        # --- regular tool calls ---
        if kind == "on_tool_start":
            run_id = ev.get("run_id", "")
            seen_tool_calls[run_id] = {"name": name, "input": data.get("input", {})}
            yield {
                "type": "tool_call",
                "content": {"tool": name, "args": data.get("input", {})},
            }
            continue

        if kind == "on_tool_end":
            run_id = ev.get("run_id", "")
            call = seen_tool_calls.get(run_id, {})
            tool_name = call.get("name", name)
            output = data.get("output")
            out_text = _extract_tool_output(output)
            if tool_name in _SUBAGENT_TOOLS:
                # The subagent's work is already represented by a `subagent` step;
                # surface its clean textual result as a subagent step instead of a
                # raw Command(...) tool_result.
                yield {"type": "subagent", "content": {"name": call.get("name", "subagent"), "result": out_text[:6000]}}
                continue
            yield {
                "type": "tool_result",
                "content": {"tool": tool_name, "result": out_text[:6000]},
            }
            continue

        # --- assistant token / final message ---
        if kind == "on_chat_model_end":
            output = data.get("output")
            msg = getattr(output, "content", None)
            text = _as_text(msg)
            if text:
                final_message = text

    yield {
        "type": "message",
        "content": {
            "message": final_message,
            "langsmith_run_id": _current_langsmith_run_id(),
        },
        "final": True,
    }
