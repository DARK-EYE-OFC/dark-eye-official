FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cache layer)
COPY package*.json./
RUN npm install --omit=dev && npm install -g pm2

COPY..

# Create dirs
RUN mkdir -p temp auth_info_baileys connection

# Env
ENV PORT=10000
ENV NODE_ENV=production
ENV HOST=0.0.0.0

EXPOSE 10000

# Healthcheck - pings /host every 30s, if fails container restarts automatically
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:10000/host || exit 1

# Use PM2 to never sleep - auto restart on crash
CMD ["pm2-runtime", "start", "index.js", "--name", "dark-eye-official", "--max-memory-restart", "300M", "--cron-restart", "0 */6 * * *"]
