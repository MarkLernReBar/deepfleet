"""Map a DeepFleet agent configuration onto a real deepagents agent.

The DeepFleet web app sends an ``AgentSpec`` (JSON) describing the agent exactly
as configured in the no-code builder. This module turns that spec into a live
agent created with ``create_deep_agent()`` from the LangChain deepagents harness.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from deepagents import create_deep_agent

from .models import resolve_model
from .tools import resolve_tools


@dataclass
class SubagentSpec:
    name: str
    description: str = ""
    prompt: str = ""
    model: str | None = None
    tools: list[str] = field(default_factory=list)


@dataclass
class AgentSpec:
    name: str
    model: str  # provider:model, e.g. "anthropic:claude-sonnet-4-6"
    system_prompt: str = ""
    tools: list[str] = field(default_factory=list)
    approval_tools: list[str] = field(default_factory=list)
    subagents: list[SubagentSpec] = field(default_factory=list)
    harness: dict[str, bool] = field(default_factory=dict)
    skills: list[str] = field(default_factory=list)

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> "AgentSpec":
        subs = [
            SubagentSpec(
                name=s.get("name", "subagent"),
                description=s.get("description", "") or "",
                prompt=s.get("prompt", "") or "",
                model=s.get("model") or None,
                tools=list(s.get("tools") or []),
            )
            for s in (data.get("subagents") or [])
        ]
        return cls(
            name=data.get("name", "agent"),
            model=data["model"],
            system_prompt=data.get("system_prompt", "") or "",
            tools=list(data.get("tools") or []),
            approval_tools=list(data.get("approval_tools") or []),
            subagents=subs,
            harness=dict(data.get("harness") or {}),
            skills=list(data.get("skills") or []),
        )


def _build_subagents(specs: list[SubagentSpec]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for s in specs:
        # deepagents 0.6.x SubAgent requires: name, description, system_prompt.
        entry: dict[str, Any] = {
            "name": s.name,
            "description": s.description or s.name,
            "system_prompt": s.prompt or f"You are the {s.name} subagent.",
        }
        if s.model:
            entry["model"] = s.model
        if s.tools:
            # Subagents reference the same built-in tool callables by slug.
            entry["tools"] = resolve_tools(s.tools)
        out.append(entry)
    return out


def build_agent(spec: AgentSpec):
    """Create a real deepagents agent from a DeepFleet AgentSpec.

    Returns the compiled LangGraph agent produced by ``create_deep_agent``.
    """
    tools = resolve_tools(spec.tools)

    kwargs: dict[str, Any] = {
        "model": resolve_model(spec.model),
        "system_prompt": spec.system_prompt,
        "tools": tools,
    }

    if spec.subagents:
        kwargs["subagents"] = _build_subagents(spec.subagents)

    # Human-in-the-loop: deepagents pauses (interrupts) before executing any tool
    # listed in interrupt_on. DeepFleet marks these as requires_approval tools.
    if spec.approval_tools:
        kwargs["interrupt_on"] = {name: True for name in spec.approval_tools}

    # The deepagents harness already includes planning (write_todos) and a virtual
    # filesystem by default. Newer versions accept a `builtin_tools` allow-list to
    # trim them; we keep defaults on unless the harness explicitly disables them.
    try:
        agent = create_deep_agent(**kwargs)
    except TypeError:
        # Older/newer signature differences: retry without optional kwargs.
        kwargs.pop("interrupt_on", None)
        agent = create_deep_agent(**kwargs)

    return agent
