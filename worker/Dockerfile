FROM python:3.12-slim

WORKDIR /app

# System deps kept minimal; httpx uses its own stack.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY deepfleet_worker ./deepfleet_worker

EXPOSE 8787

# DEEPFLEET_WORKER_TOKEN and provider API keys are passed at runtime via -e / --env-file
CMD ["uvicorn", "deepfleet_worker.app:app", "--host", "0.0.0.0", "--port", "8787"]
