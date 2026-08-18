FROM node:22-alpine

WORKDIR /app

COPY api/package*.json ./

RUN npm install --omit=dev

COPY api/src ./src

ENV NODE_ENV=production

EXPOSE 4000

CMD ["npm", "start"]
