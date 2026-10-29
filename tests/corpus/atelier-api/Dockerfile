FROM node:22-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "exec", "tsx", "src/server.ts"]
