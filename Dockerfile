FROM node:24-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim AS runner
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 APP_MODE=hosted ENV=production PORT=8000 STATIC_DIR=/app/frontend/dist
RUN pip install --no-cache-dir uv==0.11.24
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock backend/README.md ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend/app ./app
COPY backend/migrations ./migrations
COPY backend/scripts ./scripts
COPY --from=frontend-builder /build/dist /app/frontend/dist
RUN useradd --create-home --uid 10001 medicinecheck
USER medicinecheck
ENV PATH="/app/backend/.venv/bin:$PATH"
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=6s --start-period=15s --retries=3 CMD python -c "from urllib.request import urlopen; import os; urlopen('http://127.0.0.1:'+os.environ.get('PORT','8000')+'/api/v2/health',timeout=4)" || exit 1
CMD ["sh", "-c", "exec python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
