# Utilizar la imagen base de Node.js 20.12.2 en Alpine
FROM node:22.14.0-alpine

# Instalar dependencias necesarias
RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
    udev \
    ttf-freefont \
    chromium \
    git \
    bash \
    && rm -rf /var/cache/apk/*

# Establecer variables de entorno para Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
ENV PUPPETEER_EXECUTABLE_PATH /usr/bin/chromium-browser

# Ajustar la configuración de Node.js para aumentar la memoria
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Directorio de trabajo
WORKDIR /usr/src/app

# Copiar package*.json primero para mejor cache
COPY package*.json ./

# Instalar solo dependencias de producción
RUN npm ci --only=production

# Copiar el resto del código
COPY . .

# Compilar TypeScript a JS (agrega este paso clave)
RUN npm run build

# Definir variables de entorno y exponer puerto
ARG env_name=production
ARG env_port=3000
ENV NODE_ENV=$env_name
ENV PORT=$env_port
EXPOSE $env_port

# Comando para correr el código compilado (ajusta "dist/index.js" si es diferente)
CMD ["node", "dist/index.js"]