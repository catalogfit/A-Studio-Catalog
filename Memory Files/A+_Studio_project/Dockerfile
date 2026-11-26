# ===== A+ Studio backend — Node + ffmpeg =====
# The backend is zero-dependency Node, but /api/compose shells out to ffmpeg, so a plain
# Render "Node" service will not do — ffmpeg is not on Render's Node image. Hence Docker.
#
# Build/run locally (optional — `node backend/server.js` still works without Docker,
# minus /api/compose unless ffmpeg is on your PATH):
#   docker build -t aplus-backend .
#   docker run -d --name aplus-backend --restart unless-stopped -p 8787:8787 \
#     --env-file backend/.env \
#     -e TEMPLATE_STORE_DIR=/data/templates -e TEMPLATE_STORE_DURABLE=true \
#     -v aplus-templates:/data aplus-backend
# --restart brings it back whenever Docker Desktop starts; the named volume keeps captured
# templates across rebuilds. After changing backend code: rebuild, `docker rm -f aplus-backend`,
# then run the line above again. Secrets come from --env-file at run time, never the image.

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
# /data is the mount point for a persistent template store (a Docker volume locally, a Render
# disk in production). It is created here, owned by `node`, so a fresh named volume inherits
# that ownership — otherwise it mounts root-owned and the store reports "not writable".
RUN mkdir -p /tmp/aplus /data/templates && chown -R node:node /tmp/aplus /data /app
USER node

EXPOSE 8787

# Render overrides PORT; server.js reads it.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||8787)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

WORKDIR /app/backend
CMD ["node", "server.js"]
