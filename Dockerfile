# ==============================================================================
# Multi-stage production Dockerfile for RxVerify v2
# Stage 1: Build React frontend
# Stage 2: Python FastAPI production server serving static assets + /api/v2
# ==============================================================================

# --- Stage 1: Frontend Builder ---
FROM node:20-alpine AS frontend-builder
WORKDIR /build

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
ARG VITE_CLERK_PUBLISHABLE_KEY=""
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}
RUN npm run build

# --- Stage 2: Production Python Runtime ---
FROM python:3.12-slim AS runner
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ENV=production \
    PORT=8000 \
    STATIC_DIR=/app/frontend/dist

# Install system dependencies if required
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY backend/pyproject.toml ./backend/
RUN pip install --no-cache-dir \
    "fastapi>=0.141.1" \
    "uvicorn[standard]>=0.54.0" \
    "pydantic-settings>=2.15.0" \
    "sqlalchemy>=2.1.1" \
    "psycopg[binary]>=3.3.6" \
    "pyjwt[crypto]>=2.15.1" \
    "clerk-backend-api>=7.0.0" \
    "python-dotenv>=1.2.3"

# Copy backend application code
COPY backend/app ./backend/app
COPY backend/migrations ./backend/migrations
COPY backend/scripts ./backend/scripts
COPY backend/data ./backend/data

# Copy built frontend assets from stage 1
COPY --from=frontend-builder /build/dist /app/frontend/dist

WORKDIR /app/backend

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/v2/health || exit 1

CMD ["sh", "-c", "python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
