
FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev   # faster & reproducible; omit dev deps in production

COPY . .

EXPOSE 8080

# Optional: add healthcheck so platform can see /health quickly
HEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 8080) + '/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
