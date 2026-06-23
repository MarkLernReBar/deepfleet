# DeepFleet deepagents Worker

This is the **self-hostable bridge** that lets DeepFleet runs execute inside the
real LangChain [`deepagents`](https://github.com/langchain-ai/deepagents)
harness. It instantiates each agent with `create_deep_agent()` and streams genuine
harness steps (`plan`, `tool_call`, `tool_result`, `subagent`, `message`) back to
the DeepFleet web app over Server-Sent Events.

When this worker is configured, DeepFleet dispatches runs to it. When it is not
configured (or unreachable), DeepFleet automatically falls back to its built-in
TypeScript run engine, so the platform always works.

```
DeepFleet (Node/tRPC)  --POST /v1/runs/stream-->  Worker (FastAPI)
       ^                                               |
       |          SSE: run | step | done | error       |
       +-----------------------------------------------+  create_deep_agent()
```

## What runs here

- `deepfleet_worker/builder.py` maps a DeepFleet `AgentSpec` onto a live `create_deep_agent()` agent.
- `deepfleet_worker/tools.py` provides LangChain tools matching DeepFleet's built-in catalog.
- `deepfleet_worker/streaming.py` converts LangGraph `astream_events` into DeepFleet step types.
- `deepfleet_worker/app.py` is the FastAPI service (`/health`, `/v1/runs/stream`).
- Optional: set `DEEPFLEET_SKILLS_DIR` to a directory of SKILL.md files the worker loads at runtime.

## Run locally

```bash
cd worker
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp env.example.txt .env   # then edit .env
# set DEEPFLEET_WORKER_TOKEN and at least one provider key

uvicorn deepfleet_worker.app:app --host 0.0.0.0 --port 8787
```

Check it:

```bash
curl localhost:8787/health
# {"status":"ok","deepagents":true,"auth":true}
```

## Docker

```bash
cd worker
docker build -t deepfleet-worker .
docker run --rm -p 8787:8787 --env-file .env deepfleet-worker
```

## systemd

Edit paths/user in `deepfleet-worker.service`, then:

```bash
sudo cp deepfleet-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now deepfleet-worker
```

## Connect to DeepFleet

In the web app, set these environment variables (or Settings → Secrets on Manus WebDev):

| Variable | Value |
|---|---|
| `WORKER_URL` | Base URL, e.g. `http://localhost:8787` |
| `WORKER_TOKEN` | Same value as `DEEPFLEET_WORKER_TOKEN` on the worker |

## Security

- Always set `DEEPFLEET_WORKER_TOKEN` in networked deployments.
- `run_shell` is disabled unless `DEEPFLEET_ALLOW_SHELL=1`.
- Put the worker behind TLS when exposing beyond localhost.
