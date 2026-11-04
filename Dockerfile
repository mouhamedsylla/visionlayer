# La démonstration publique : les projets de `demo/` (hors dépôt) copiés dans l'image.
# Passer MODEL_API_KEY à l'exécution, jamais dans l'image.
FROM node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends git python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && git config --global --add safe.directory '*'
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm app:build
ENV PORT=8080
EXPOSE 8080
CMD ["pnpm", "start", "--demo", "demo"]
