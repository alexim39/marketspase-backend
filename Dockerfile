FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./

ENV NODE_ENV=production

RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi \
    && npm cache clean --force

COPY . .

EXPOSE 8080/tcp

CMD ["npm", "start"]
