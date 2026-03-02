FROM node:22-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src/
RUN npx tsc

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]
