FROM node:20.10.0-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY packages ./packages
COPY services ./services

CMD ["npm", "run", "review-service"]
