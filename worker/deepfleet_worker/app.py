"""DeepFleet deepagents worker — FastAPI service.

This is the self-hostable bridge that runs DeepFleet agents inside the *real*
LangChain deepagents harness (``create_deep_agent``) and streams genuine harness
steps back to the DeepFleet web app over Server-Sent Events (SSE).

Endpoints
---------
GET  /health                 -> liveness + deepagents availability
POST /v1/runs/stream         -> run an AgentSpec, stream step events as SSE
POST /v1/runs/{id}/resume    -> resume a run that paused for HITL approval

Auth
----
All endpoints except /health require ``Authorization: Bearer <WORKER_TOKEN>``
when the ``DEEPFLEET_WORKER_TOKEN`` env var is set.

Run it
------
    pip install -r requirements.txt
    export DEEPFLEET_WORKER_TOKEN=...        # shared secret with DeepFleet
    export ANTHROPIC_API_KEY=... / OPENAI_API_KEY=... / GOOGLE_API_KEY=...
    uvicorn deepfleet_worker.app:app --host 0.0.0.0 --port 8787
"""

from __future__ import annotations

import json
import os
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .builder import AgentSpec, build_agent
from .streaming import stream_agent_events

app = FastAPI(title="DeepFleet deepagents worker", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("DEEPFLEET_CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_token(authorization: str | None = Header(default=None)) -> None:
    expected = os.environ.get("DEEPFLEET_WORKER_TOKEN")
    if not expected:
        return  # auth disabled when no token configured (local dev)
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    if authorization.split(" ", 1)[1] != expected:
        raise HTTPException(status_code=401, detail="invalid token")


class SubagentIn(BaseModel):
    name: str
    description: str = ""
    prompt: str = ""
    model: str | None = None
    tools: list[str] = []


class RunRequest(BaseModel):
    run_id: str | int | None = None
    name: str = "agent"
    model: str
    system_prompt: str = ""
    tools: list[str] = []
    approval_tools: list[str] = []
    subagents: list[SubagentIn] = []
    harness: dict[str, bool] = {}
    skills: list[str] = []
    input: str


def _deepagents_available() -> bool:
    try:
        import deepagents  # noqa: F401

        return True
    except Exception:  # noqa: BLE001
        return False


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "deepagents": _deepagents_available(),
        "auth": bool(os.environ.get("DEEPFLEET_WORKER_TOKEN")),
    }


def _sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


@app.post("/v1/runs/stream", dependencies=[Depends(require_token)])
async def run_stream(req: RunRequest) -> StreamingResponse:
    if not _deepagents_available():
        raise HTTPException(status_code=503, detail="deepagents not installed on worker")

    spec = AgentSpec.from_json(
        {
            "name": req.name,
            "model": req.model,
            "system_prompt": req.system_prompt,
            "tools": req.tools,
            "approval_tools": req.approval_tools,
            "subagents": [s.model_dump() for s in req.subagents],
            "harness": req.harness,
            "skills": req.skills,
        }
    )

    async def gen():
        yield _sse("run", {"runId": req.run_id, "status": "running", "engine": "deepagents-worker"})
        try:
            agent = build_agent(spec)
            async for step in stream_agent_events(agent, req.input):
                if step.get("final"):
                    content = step["content"]
                    yield _sse(
                        "done",
                        {
                            "runId": req.run_id,
                            "status": "succeeded",
                            "output": content.get("message", ""),
                            "langsmith_run_id": content.get("langsmith_run_id"),
                        },
                    )
                else:
                    yield _sse("step", {"type": step["type"], "content": step["content"]})
        except Exception as exc:  # noqa: BLE001
            yield _sse("error", {"runId": req.run_id, "status": "failed", "error": str(exc)})

    return StreamingResponse(gen(), media_type="text/event-stream")
