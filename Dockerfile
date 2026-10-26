# syntax=docker/dockerfile:1
# ── Этап сборки фронтенда (Vite + React + TypeScript) ─────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Кэширование зависимостей
COPY package.json package-lock.json ./
RUN npm ci

# Сборка статических файлов SPA
COPY . .
RUN npm run build

# ── Финальный легковесный образ с Nginx ────────────────────────────────────────
FROM nginx:alpine

# Удаляем дефолтные страницы и конфигурации
RUN rm -rf /etc/nginx/conf.d/*

# Копируем скомпилированную статику
COPY --from=builder /app/dist /usr/share/nginx/html

# Копируем оптимизированный конфигурационный файл Nginx с проксированием к API
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Проверка доступности веб-сервера (healthcheck)
HEALTHCHECK --interval=20s --timeout=3s --retries=3 \
    CMD wget -qO- http://127.0.0.1:80/ || exit 1

# Открываем стандартный HTTP-порт
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
