FROM node:22-slim

# Install gcc for C code compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libc6-dev \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Copy source
COPY backend/ ./backend/
COPY frontend/ ./frontend/

WORKDIR /app/backend

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

CMD ["node", "server.js"]
