# Dockerfile — CIPAM IPR Translator (backend + built frontend in one container)
# Build:  docker build -t cipam-ipr-translator .
# Run:    docker run -p 5001:10000 --env-file .env -e PORT=10000 cipam-ipr-translator

# ── Stage 1: build the React frontend ────────────────────────
FROM node:22-bookworm-slim AS client
WORKDIR /client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
# Same-domain API + real backend (the client defaults to mock data otherwise)
ENV VITE_API_URL=/api \
    VITE_USE_MOCK_AUTH=false \
    VITE_USE_MOCK_DOCUMENTS=false \
    VITE_USE_MOCK_TRANSLATIONS=false \
    VITE_USE_MOCK_EXPORTS=false \
    VITE_USE_MOCK_GLOSSARY=false
RUN npm run build

# ── Stage 2: runtime ─────────────────────────────────────────
FROM node:22-bookworm-slim

# Chromium for PDF export (puppeteer) + Noto fonts as an offline fallback for Indic scripts
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-noto-core ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    CHROMIUM_NO_SANDBOX=true \
    PORT=10000

WORKDIR /app

# Install dependencies (postinstall runs `prisma generate`, so the schema must be present)
COPY package.json package-lock.json prisma.config.js ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY --from=client /client/dist ./client/dist

# Download the OCR English model now, so the first scanned upload doesn't have to
RUN node -e "require('tesseract.js').createWorker('eng').then(w => w.terminate())"

# Run as the unprivileged "node" user. It only needs to write uploads (and /app for
# any cache files); a recursive chown would duplicate node_modules (~600 MB) in a new layer.
RUN mkdir -p server/uploads && chown node:node /app /app/server/uploads
USER node

EXPOSE 10000

# Apply pending database migrations, then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node server/index.js"]
