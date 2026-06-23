"""Built-in tool implementations for the DeepFleet deepagents worker.

These are *real* LangChain tools that the deepagents harness can call. The slugs
here mirror DeepFleet's built-in tool catalog (see ``shared/catalog.ts``) so that
an agent configured in the DeepFleet UI maps onto concrete, runnable tools.

Every tool is a plain Python callable decorated with ``@tool`` from langchain_core.
deepagents accepts these directly in ``create_deep_agent(tools=[...])``.
"""

from __future__ import annotations

import json
import subprocess
from typing import Callable

import httpx
from langchain_core.tools import tool


@tool
def web_search(query: str) -> str:
    """Search the web and return a short list of ranked results for the query.

    Uses the DuckDuckGo Instant Answer API (no key required). Returns JSON text.
    """
    try:
        resp = httpx.get(
            "https://api.duckduckgo.com/",
            params={"q": query, "format": "json", "no_html": 1, "skip_disambig": 1},
            timeout=20.0,
        )
        data = resp.json()
        results = []
        if data.get("AbstractText"):
            results.append({"title": data.get("Heading", query), "snippet": data["AbstractText"], "url": data.get("AbstractURL", "")})
        for topic in (data.get("RelatedTopics") or [])[:6]:
            if isinstance(topic, dict) and topic.get("Text"):
                results.append({"title": topic.get("Text", "")[:80], "snippet": topic.get("Text", ""), "url": topic.get("FirstURL", "")})
        if not results:
            results.append({"title": query, "snippet": "No instant answer available.", "url": ""})
        return json.dumps(results[:6], indent=2)
    except Exception as exc:  # noqa: BLE001
        return f"web_search error: {exc}"


@tool
def http_fetch(url: str) -> str:
    """Fetch the textual contents of a URL (truncated to ~8k chars)."""
    try:
        resp = httpx.get(url, timeout=30.0, follow_redirects=True, headers={"User-Agent": "DeepFleet/1.0"})
        text = resp.text
        return text[:8000]
    except Exception as exc:  # noqa: BLE001
        return f"http_fetch error: {exc}"


@tool
def calculator(expression: str) -> str:
    """Evaluate a basic arithmetic expression and return the numeric result."""
    allowed = set("0123456789.+-*/() %")
    if not set(expression) <= allowed:
        return "calculator error: expression contains unsupported characters"
    try:
        # Safe: only arithmetic characters are allowed above.
        return str(eval(expression, {"__builtins__": {}}, {}))  # noqa: S307
    except Exception as exc:  # noqa: BLE001
        return f"calculator error: {exc}"


@tool
def run_query(query: str) -> str:
    """Run a read-only SQL query. This default impl echoes the query.

    Replace the body with a real read-only connection for your environment.
    """
    if not query.strip().lower().startswith("select"):
        return "run_query error: only SELECT statements are permitted"
    return f"[run_query] would execute (read-only): {query}"


@tool
def send_email(to: str, subject: str, body: str) -> str:
    """Send an email. Requires human approval (interrupt_on) in DeepFleet.

    The default implementation does not actually send; wire up an SMTP/API
    client for your environment. It returns a confirmation string.
    """
    return f"[send_email] queued message to={to!r} subject={subject!r} ({len(body)} chars)"


@tool
def run_shell(command: str) -> str:
    """Execute a shell command. Requires human approval (interrupt_on).

    Disabled by default for safety; set DEEPFLEET_ALLOW_SHELL=1 to enable.
    """
    import os

    if os.environ.get("DEEPFLEET_ALLOW_SHELL") != "1":
        return "run_shell disabled: set DEEPFLEET_ALLOW_SHELL=1 to enable"
    try:
        out = subprocess.run(  # noqa: S602
            command, shell=True, capture_output=True, text=True, timeout=30
        )
        return (out.stdout or "") + (("\n[stderr] " + out.stderr) if out.stderr else "")
    except Exception as exc:  # noqa: BLE001
        return f"run_shell error: {exc}"


# Map DeepFleet built-in tool slugs -> real callables. read_file / write_file are
# intentionally omitted: deepagents provides its own virtual filesystem tools when
# the filesystem harness option is enabled, so we let the harness supply those.
BUILTIN_TOOLS: dict[str, Callable] = {
    "web_search": web_search,
    "http_fetch": http_fetch,
    "calculator": calculator,
    "run_query": run_query,
    "send_email": send_email,
    "run_shell": run_shell,
}


def resolve_tools(slugs: list[str]) -> list:
    """Resolve a list of DeepFleet tool slugs into real tool callables."""
    resolved = []
    for slug in slugs:
        fn = BUILTIN_TOOLS.get(slug)
        if fn is not None:
            resolved.append(fn)
    return resolved
