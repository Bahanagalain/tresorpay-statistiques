# ── Etape 1 : Build React ─────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ARG VITE_APP_BASE_PATH=/
ENV VITE_APP_BASE_PATH=$VITE_APP_BASE_PATH

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ── Etape 2 : Servir avec Nginx ──────────────────────────────
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
