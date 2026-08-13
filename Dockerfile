FROM node:20.10.0-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY packages ./packages
COPY public ./public
COPY src ./src
COPY views ./views
COPY app.js ./

CMD ["npm", "start"]
