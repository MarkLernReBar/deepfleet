#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE="/tmp/minigpt-showcase"

cd "$ROOT"

# Directories
mkdir -p client/src/{pages,components,lib,_core/hooks,contexts}
mkdir -p server/_core/types
mkdir -p shared/_core
mkdir -p drizzle/migrations
mkdir -p worker/deepfleet_worker
mkdir -p docs

# --- Move DeepFleet application files ---

# Shared
mv -f const.ts shared/const.ts 2>/dev/null || true
mv -f catalog.ts shared/catalog.ts 2>/dev/null || true

# Drizzle
mv -f schema.ts drizzle/schema.ts 2>/dev/null || true
mv -f 0001_parallel_thundra.sql drizzle/migrations/0001_parallel_thundra.sql 2>/dev/null || true

# Server
for f in routers.ts fleetRouter.ts db.ts seed.ts codeExport.ts codeExport.test.ts orchestrator.ts workerBridge.ts; do
  mv -f "$f" "server/$f" 2>/dev/null || true
done

for f in index.ts context.ts sdk.ts env.ts llm.ts trpc.ts; do
  mv -f "$f" "server/_core/$f" 2>/dev/null || true
done

# Client
mv -f index.html client/index.html 2>/dev/null || true
mv -f main.tsx client/src/main.tsx 2>/dev/null || true
mv -f App.tsx client/src/App.tsx 2>/dev/null || true
mv -f index.css client/src/index.css 2>/dev/null || true
mv -f Shell.tsx client/src/components/Shell.tsx 2>/dev/null || true
mv -f brutal.tsx client/src/components/brutal.tsx 2>/dev/null || true
mv -f useAuth.ts client/src/_core/hooks/useAuth.ts 2>/dev/null || true
mv -f runStream.ts client/src/lib/runStream.ts 2>/dev/null || true

for page in Overview Fleets Agents AgentBuilder AgentDetail Runs RunTrace Inbox Tools Credentials; do
  mv -f "${page}.tsx" "client/src/pages/${page}.tsx" 2>/dev/null || true
done

# Python worker
for f in __init__.py app.py builder.py streaming.py tools.py models.py; do
  mv -f "$f" "worker/deepfleet_worker/$f" 2>/dev/null || true
done
mv -f requirements.txt worker/requirements.txt 2>/dev/null || true
mv -f Dockerfile worker/Dockerfile 2>/dev/null || true
mv -f env.example.txt worker/env.example.txt 2>/dev/null || true
mv -f deepfleet-worker.service worker/deepfleet-worker.service 2>/dev/null || true

# Docs (optional reference material)
mv -f cloud-computer-reference.md docs/cloud-computer-reference.md 2>/dev/null || true
mv -f SKILL.md docs/SKILL.md 2>/dev/null || true

echo "DeepFleet files moved."
