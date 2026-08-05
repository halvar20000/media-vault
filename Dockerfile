# Single combined image: builds the React SPA and the Express API, then runs
# Node serving both (API on /api/*, the SPA everywhere else). One container.

# ---- frontend build ----
FROM node:20-alpine AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ---- backend build ----
FROM node:20-alpine AS backend
WORKDIR /be
COPY backend/package.json backend/package-lock.json* ./
RUN npm install
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# ---- runtime ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV FRONTEND_DIR=/app/public
ENV COVERS_DIR=/app/data/covers
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev
COPY --from=backend /be/dist ./dist
COPY --from=frontend /fe/dist ./public
EXPOSE 4000
# Apply schema, seed (idempotent), then start the API + static server.
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/db/seed.js && node dist/index.js"]
