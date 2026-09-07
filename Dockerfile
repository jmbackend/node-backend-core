FROM node:22-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm ci --omit=dev

COPY --chown=node:node src ./src

RUN mkdir -p src/logs && chown -R node:node /usr/src/app

USER node

EXPOSE 3000

CMD ["node", "src/server.js"]