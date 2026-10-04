FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# O Vite assa a URL da API no bundle; por isso ela e argumento de build, nao
# variavel de runtime.
ARG VITE_API_URL=http://localhost:8080
ARG VITE_GATEWAY_URL=http://localhost:3000
ARG VITE_WS_URL=ws://localhost:3000/ws
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
