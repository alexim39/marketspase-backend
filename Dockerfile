FROM node:20

WORKDIR /app

COPY package*.json ./

ENV NODE_ENV=production

RUN npm ci --omit=dev && npm cache clean --force

COPY . .

EXPOSE 8080/tcp

CMD ["npm", "start"]
