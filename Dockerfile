# Dev image con hot-reload
FROM node:20-alpine

WORKDIR /app

# Instala deps base
COPY package*.json ./
RUN npm install

# Copia el código (en dev igual montamos con bind, pero sirve para primer build)
COPY . .

EXPOSE 3000
CMD ["npm","run","start:dev"]
