### Stage 1: Build Next.js frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

### Stage 2: Final image
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl nodejs && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Install ArcticSwarm from local source (avoids GitHub network issues in China)
COPY arcticswarm-src /tmp/arcticswarm-src
RUN pip install --no-cache-dir --no-deps /tmp/arcticswarm-src \
    # Copy skills + eval data (non-Python files not included by pip install)
    && SITE=$(python -c "import arcticswarm, pathlib; print(pathlib.Path(arcticswarm.__file__).parent)") \
    && cp -r /tmp/arcticswarm-src/arcticswarm/skills "$SITE/skills" \
    && cp -r /tmp/arcticswarm-src/arcticswarm/eval "$SITE/eval" \
    && rm -rf /tmp/arcticswarm-src

# Copy backend (includes sv_scripts/)
COPY backend /app/backend

# Copy frontend standalone build
COPY --from=frontend-builder /app/frontend/.next/standalone /app/frontend
COPY --from=frontend-builder /app/frontend/.next/static /app/frontend/.next/static
COPY --from=frontend-builder /app/frontend/public /app/frontend/public

ENV PYTHONPATH=/app/backend
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV USE_ARCTICSWARM=true

EXPOSE 3000

# Start script: backend on 8000, frontend on 3000
RUN printf '#!/bin/sh\ncd /app/backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 &\ncd /app/frontend && node server.js\n' > /app/start.sh && chmod +x /app/start.sh

CMD ["/app/start.sh"]
