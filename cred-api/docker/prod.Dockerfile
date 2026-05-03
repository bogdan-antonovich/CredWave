FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY db/ ./db/
COPY docker/migrate.sh ./migrate.sh
RUN chmod +x migrate.sh
EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]
