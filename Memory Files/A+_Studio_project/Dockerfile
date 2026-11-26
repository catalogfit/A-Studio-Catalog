# ===== A+ Studio backend — Node + ffmpeg =====
# The backend is zero-dependency Node, but /api/compose shells out to ffmpeg, so a plain
# Render "Node" service will not do — ffmpeg is not on Render's Node image. Hence Docker.
#
# Build/run locally (optional — `node backend/server.js` still works without Docker,
# minus /api/compose unless ffmpeg is on your PATH):
#   docker build -t aplus-backend .
#   docker run --rm -p 8787:8787 --env-file backend/.env aplus-backend

FROM node:20-bookworm-slim

# ffmpeg (with libx264 for the MP4 output path) + CA certs for the Google HTTPS calls.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=8787 \
    APLUS_TMP_DIR=/tmp/aplus

WORKDIR /app

# There are no npm dependencies, so there is nothing to `npm install`. package.json is copied
# first anyway so Docker can cache this layer if dependencies are ever added.
COPY backend/package.json ./backend/package.json

COPY backend/ ./backend/

# Non-root. /tmp/aplus holds the short-lived ffmpeg scratch files for a single compose job.
RUN mkdir -p /tmp/aplus && chown -R node:node /tmp/aplus /app
USER node

EXPOSE 8787

# Render overrides PORT; server.js reads it.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||8787)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

WORKDIR /app/backend
CMD ["node", "server.js"]
