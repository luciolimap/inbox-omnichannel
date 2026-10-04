FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
# dist/main.js, nao dist/server.js: o server.ts so exporta buildServer, para o
# teste importar sem abrir porta. Quem escuta e o main.ts.
CMD ["node", "dist/main.js"]
