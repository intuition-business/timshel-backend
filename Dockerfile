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

# Directorio de trabajo y copia de la aplicación
WORKDIR /usr/src/app

# Copiar todos los archivos, incluyendo el archivo .env
COPY . .

# Instalar dependencias de la aplicación
RUN npm install
RUN npm install typescript
RUN npm install dotenv

# Definir variables de entorno y exponer puerto
ARG env_name
ARG env_port
ENV NODE_ENV=$env_name
ENV PORT=$env_port
EXPOSE $env_port

# Comando para iniciar la aplicación
CMD ["npm", "run", "dev"]