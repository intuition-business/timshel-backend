FROM node:22.14.0-alpine

RUN apk update && apk add --no-cache \
    udev ttf-freefont chromium git bash \
    && rm -rf /var/cache/apk/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_OPTIONS="--max-old-space-size=4096"

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV

ENV PORT=3000
EXPOSE 3000

CMD ["npm","start"]
