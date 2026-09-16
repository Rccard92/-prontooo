# Immagine del worker. Railway punta la root directory su apps/worker e trova
# questo Dockerfile: il resto del monorepo non gli serve.
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev

COPY . .

CMD ["uv", "run", "--no-sync", "python", "main.py"]
