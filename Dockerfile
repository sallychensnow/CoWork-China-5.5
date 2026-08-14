### Stage 1: Build Next.js frontend
FROM docker.m.daocloud.io/node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

### Stage 2: Final image
FROM docker.m.daocloud.io/python:3.11-slim

RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true
RUN apt-get update && apt-get install -y --no-install-recommends curl nodejs && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ -r requirements.txt

# Copy backend
COPY backend /app/backend

# Copy frontend standalone build
COPY --from=frontend-builder /app/frontend/.next/standalone /app/frontend
COPY --from=frontend-builder /app/frontend/.next/static /app/frontend/.next/static
COPY --from=frontend-builder /app/frontend/public /app/frontend/public

ENV PYTHONPATH=/app/backend
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

# Start script: backend on 8000, frontend on 3000
RUN printf '#!/bin/sh\ncd /app/backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 &\ncd /app/frontend && node server.js\n' > /app/start.sh && chmod +x /app/start.sh

CMD ["/app/start.sh"]
