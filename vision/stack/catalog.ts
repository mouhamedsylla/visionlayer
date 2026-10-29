import type { Ecosystem, TechCategory } from "./types.js";

/**
 * Catalogue des technologies connues : il NOMME et RANGE, il ne déduit rien.
 * Une technologie n'apparaît dans l'inventaire que si une preuve du
 * repository la désigne (paquet, fichier de config, image, paquet système…).
 *
 * Motifs : `nom` exact, `préfixe*` (ex. `@radix-ui/*`, `texlive*`).
 * `icon` : slug Simple Icons (https://simpleicons.org) — vérifié par test.
 * `facets` : paquet, import (`firebase/auth`) ou composant → sous-partie.
 */
export interface CatalogEntry {
  id: string;
  name: string;
  category: TechCategory;
  icon?: string;
  npm?: string[];
  pypi?: string[];
  go?: string[];
  cargo?: string[];
  composer?: string[];
  gem?: string[];
  /** Nom d'image de conteneur (dernier segment, sans tag) : `node`, `postgres`, `bitnami/redis`. */
  images?: string[];
  /** Paquets système installés dans un Dockerfile (apt, apk). */
  system?: string[];
  /** Fichiers de configuration qui prouvent l'usage. */
  config?: RegExp[];
  facets?: Record<string, string>;
}

export const CATALOG: CatalogEntry[] = [
  // ─── Langages ───────────────────────────────────────────────
  { id: "typescript", name: "TypeScript", category: "language", icon: "typescript", npm: ["typescript"], config: [/(^|\/)tsconfig[^/]*\.json$/] },
  { id: "javascript", name: "JavaScript", category: "language", icon: "javascript" },
  { id: "python", name: "Python", category: "language", icon: "python", images: ["python"], system: ["python3", "python3-pip", "python3-dev"], config: [/(^|\/)(pyproject\.toml|requirements[^/]*\.txt|setup\.py|Pipfile)$/] },
  { id: "go", name: "Go", category: "language", icon: "go", images: ["golang"], config: [/(^|\/)go\.mod$/] },
  { id: "rust", name: "Rust", category: "language", icon: "rust", images: ["rust"], config: [/(^|\/)Cargo\.toml$/] },
  { id: "php", name: "PHP", category: "language", icon: "php", images: ["php"], config: [/(^|\/)composer\.json$/] },
  { id: "ruby", name: "Ruby", category: "language", icon: "ruby", images: ["ruby"], config: [/(^|\/)Gemfile$/] },
  { id: "java", name: "Java", category: "language", icon: "openjdk", images: ["openjdk", "eclipse-temurin", "amazoncorretto"], config: [/(^|\/)(pom\.xml|build\.gradle(\.kts)?)$/] },
  { id: "kotlin", name: "Kotlin", category: "language", icon: "kotlin" },
  { id: "swift", name: "Swift", category: "language", icon: "swift", config: [/(^|\/)Package\.swift$/] },
  { id: "csharp", name: "C#", category: "language", icon: "dotnet" },
  { id: "html", name: "HTML", category: "language", icon: "html5" },
  { id: "css", name: "CSS", category: "language", icon: "css" },
  { id: "sass", name: "Sass", category: "styling", icon: "sass", npm: ["sass", "node-sass"] },
  { id: "shell", name: "Shell", category: "language", icon: "gnubash" },
  { id: "sql", name: "SQL", category: "language", icon: "sqlite" },
  { id: "latex", name: "LaTeX", category: "media", icon: "latex", system: ["texlive*", "cm-super", "dvisvgm", "latexmk"] },

  // ─── Exécution & gestion de paquets ─────────────────────────
  { id: "nodejs", name: "Node.js", category: "runtime", icon: "nodedotjs", npm: ["@types/node"], images: ["node"], system: ["nodejs"], config: [/(^|\/)\.(nvmrc|node-version)$/] },
  { id: "deno", name: "Deno", category: "runtime", icon: "deno", images: ["denoland/deno"], config: [/(^|\/)deno\.jsonc?$/] },
  { id: "bun", name: "Bun", category: "runtime", icon: "bun", images: ["oven/bun"], config: [/(^|\/)bun\.lockb?$/] },
  { id: "pnpm", name: "pnpm", category: "build", icon: "pnpm", config: [/(^|\/)pnpm-(lock|workspace)\.yaml$/] },
  { id: "npm", name: "npm", category: "build", icon: "npm", config: [/(^|\/)package-lock\.json$/] },
  { id: "yarn", name: "Yarn", category: "build", icon: "yarn", config: [/(^|\/)yarn\.lock$/] },
  { id: "pip", name: "pip", category: "build", icon: "pypi", pypi: ["pip"] },
  { id: "setuptools", name: "setuptools", category: "build", icon: "python", pypi: ["setuptools"] },
  { id: "poetry", name: "Poetry", category: "build", icon: "poetry", pypi: ["poetry", "poetry-core"], config: [/(^|\/)poetry\.lock$/] },
  { id: "uv", name: "uv", category: "build", icon: "uv", config: [/(^|\/)uv\.lock$/] },

  // ─── Frameworks & UI ────────────────────────────────────────
  { id: "react", name: "React", category: "framework", icon: "react", npm: ["react", "react-dom", "@types/react", "@types/react-dom"], facets: { "react-dom": "DOM" } },
  { id: "react-router", name: "React Router", category: "framework", icon: "reactrouter", npm: ["react-router", "react-router-dom", "@react-router/*"] },
  { id: "nextjs", name: "Next.js", category: "framework", icon: "nextdotjs", npm: ["next"], config: [/(^|\/)next\.config\.[cm]?[jt]s$/] },
  { id: "remix", name: "Remix", category: "framework", icon: "remix", npm: ["@remix-run/*"] },
  { id: "vue", name: "Vue.js", category: "framework", icon: "vuedotjs", npm: ["vue", "@vue/*"] },
  { id: "nuxt", name: "Nuxt", category: "framework", icon: "nuxt", npm: ["nuxt"] },
  { id: "svelte", name: "Svelte", category: "framework", icon: "svelte", npm: ["svelte", "@sveltejs/*"] },
  { id: "angular", name: "Angular", category: "framework", icon: "angular", npm: ["@angular/*"] },
  { id: "solid", name: "Solid", category: "framework", icon: "solid", npm: ["solid-js"] },
  { id: "astro", name: "Astro", category: "framework", icon: "astro", npm: ["astro"] },
  { id: "react-native", name: "React Native", category: "framework", icon: "react", npm: ["react-native"] },
  { id: "expo", name: "Expo", category: "framework", icon: "expo", npm: ["expo", "expo-*"] },
  { id: "motion", name: "Motion", category: "framework", icon: "framer", npm: ["motion", "framer-motion"] },
  { id: "lucide", name: "Lucide", category: "framework", icon: "lucide", npm: ["lucide-react", "lucide"] },
  { id: "radix", name: "Radix UI", category: "framework", icon: "radixui", npm: ["@radix-ui/*"] },
  { id: "shadcn", name: "shadcn/ui", category: "framework", icon: "shadcnui", config: [/(^|\/)components\.json$/] },
  { id: "mui", name: "MUI", category: "framework", icon: "mui", npm: ["@mui/*"] },
  { id: "pwa", name: "PWA", category: "framework", icon: "pwa", npm: ["vite-plugin-pwa", "workbox-*", "next-pwa"] },
  { id: "flask", name: "Flask", category: "backend", icon: "flask", pypi: ["flask"] },
  { id: "django", name: "Django", category: "backend", icon: "django", pypi: ["django"] },
  { id: "fastapi", name: "FastAPI", category: "backend", icon: "fastapi", pypi: ["fastapi"] },
  { id: "laravel", name: "Laravel", category: "backend", icon: "laravel", composer: ["laravel/framework"] },
  { id: "symfony", name: "Symfony", category: "backend", icon: "symfony", composer: ["symfony/*"] },
  { id: "rails", name: "Ruby on Rails", category: "backend", icon: "rubyonrails", gem: ["rails"] },
  { id: "gin", name: "Gin", category: "backend", icon: "gin", go: ["github.com/gin-gonic/gin"] },
  { id: "axum", name: "Axum", category: "backend", cargo: ["axum"] },
  { id: "tokio", name: "Tokio", category: "backend", icon: "tokio", cargo: ["tokio"] },

  // ─── Style ──────────────────────────────────────────────────
  { id: "tailwindcss", name: "Tailwind CSS", category: "styling", icon: "tailwindcss", npm: ["tailwindcss", "@tailwindcss/*"], config: [/(^|\/)tailwind\.config\.[cm]?[jt]s$/] },
  { id: "postcss", name: "PostCSS", category: "styling", icon: "postcss", npm: ["postcss", "autoprefixer"], facets: { autoprefixer: "Autoprefixer" }, config: [/(^|\/)postcss\.config\.[cm]?[jt]s$/] },
  { id: "styled-components", name: "styled-components", category: "styling", icon: "styledcomponents", npm: ["styled-components"] },
  { id: "emotion", name: "Emotion", category: "styling", npm: ["@emotion/*"] },

  // ─── Données & état ─────────────────────────────────────────
  { id: "tanstack-query", name: "TanStack Query", category: "data", icon: "reactquery", npm: ["@tanstack/react-query", "@tanstack/react-query-devtools", "@tanstack/query-*"], facets: { "@tanstack/react-query-devtools": "Devtools" } },
  { id: "zustand", name: "Zustand", category: "data", npm: ["zustand"] },
  { id: "redux", name: "Redux", category: "data", icon: "redux", npm: ["redux", "@reduxjs/toolkit", "react-redux"] },
  { id: "zod", name: "Zod", category: "data", icon: "zod", npm: ["zod", "zod-to-json-schema"], facets: { "zod-to-json-schema": "JSON Schema" } },
  { id: "graphql", name: "GraphQL", category: "data", icon: "graphql", npm: ["graphql", "@apollo/*", "urql"] },
  { id: "trpc", name: "tRPC", category: "data", icon: "trpc", npm: ["@trpc/*"] },
  { id: "axios", name: "Axios", category: "data", icon: "axios", npm: ["axios"] },
  { id: "pydantic", name: "Pydantic", category: "data", icon: "pydantic", pypi: ["pydantic"] },
  { id: "numpy", name: "NumPy", category: "data", icon: "numpy", pypi: ["numpy"] },
  { id: "pandas", name: "pandas", category: "data", icon: "pandas", pypi: ["pandas"] },
  { id: "dotenv", name: "dotenv", category: "data", icon: "dotenv", npm: ["dotenv"], pypi: ["python-dotenv"] },
  { id: "nanoid", name: "Nano ID", category: "data", npm: ["nanoid"] },
  { id: "mathjs", name: "Math.js", category: "data", npm: ["mathjs"] },

  // ─── Backend & API ──────────────────────────────────────────
  { id: "express", name: "Express", category: "backend", icon: "express", npm: ["express", "@types/express"] },
  { id: "stripe", name: "Stripe", category: "backend", icon: "stripe", npm: ["stripe", "@stripe/stripe-js", "@stripe/react-stripe-js"], pypi: ["stripe"] },
  { id: "resend", name: "Resend", category: "backend", icon: "resend", npm: ["resend"], pypi: ["resend"] },
  { id: "nodemailer", name: "Nodemailer", category: "backend", npm: ["nodemailer", "@types/nodemailer"] },
  { id: "bullmq", name: "BullMQ", category: "backend", npm: ["bullmq", "bull"] },
  { id: "nodecron", name: "node-cron", category: "backend", npm: ["node-cron", "@types/node-cron", "cron"] },
  { id: "fastify", name: "Fastify", category: "backend", icon: "fastify", npm: ["fastify"] },
  { id: "hono", name: "Hono", category: "backend", icon: "hono", npm: ["hono"] },
  { id: "nestjs", name: "NestJS", category: "backend", icon: "nestjs", npm: ["@nestjs/*"] },
  { id: "mcp", name: "Model Context Protocol", category: "backend", icon: "modelcontextprotocol", npm: ["@modelcontextprotocol/*"], pypi: ["mcp"] },

  // ─── Cloud & hébergement ────────────────────────────────────
  {
    id: "firebase",
    name: "Firebase",
    category: "cloud",
    icon: "firebase",
    npm: ["firebase", "firebase-admin", "firebase-functions", "firebase-tools", "@firebase/*"],
    pypi: ["firebase-admin"],
    config: [/(^|\/)(firebase\.json|\.firebaserc|firestore\.rules|firestore\.indexes\.json|storage\.rules|database\.rules\.json)$/],
    facets: {
      "firebase-admin": "Admin SDK",
      "firebase-functions": "Cloud Functions",
      "@firebase/rules-unit-testing": "Tests des règles",
      "@firebase/eslint-plugin-security-rules": "Lint des règles",
      "firebase/auth": "Authentication",
      "firebase/firestore": "Firestore",
      "firebase/storage": "Storage",
      "firebase/functions": "Cloud Functions",
      "firebase/app-check": "App Check",
      "firebase/analytics": "Analytics",
      "firebase/messaging": "Cloud Messaging",
      "firebase/database": "Realtime Database",
      "firebase/remote-config": "Remote Config",
      "firebase/performance": "Performance",
      "firebase-admin/firestore": "Firestore",
      "firebase-admin/auth": "Authentication",
      "firebase-admin/storage": "Storage",
      "firebase-functions/v2": "Cloud Functions",
      "firestore.rules": "Firestore",
      "storage.rules": "Storage",
      "infra:host": "Hosting",
      "infra:database": "Firestore",
      "infra:storage": "Storage",
      "infra:service": "Cloud Functions",
    },
  },
  {
    id: "googlecloud",
    name: "Google Cloud",
    category: "cloud",
    icon: "googlecloud",
    npm: ["@google-cloud/*", "google-auth-library", "googleapis"],
    pypi: ["google-cloud-*", "google-auth"],
    images: ["gcr.io/cloud-builders/*", "gcr.io/google.com/cloudsdktool/*", "google/cloud-sdk"],
    config: [/(^|\/)(cloudbuild[^/]*\.ya?ml|app\.yaml)$/],
    facets: {
      "@google-cloud/tasks": "Cloud Tasks",
      "@google-cloud/storage": "Cloud Storage",
      "@google-cloud/firestore": "Firestore",
      "@google-cloud/pubsub": "Pub/Sub",
      "@google-cloud/secret-manager": "Secret Manager",
      "@google-cloud/logging": "Cloud Logging",
      "@google-cloud/vertexai": "Vertex AI",
      "@google-cloud/run": "Cloud Run",
      "google-auth-library": "IAM (auth)",
      "infra:job": "Cloud Build",
      "cloudbuild.yaml": "Cloud Build",
    },
  },
  // Produits gérés, désignés par un manifeste ou un pack (firebase.json, déclencheurs) : jamais par un paquet seul.
  { id: "firestore", name: "Firestore", category: "database", icon: "firebase" },
  { id: "firebasestorage", name: "Cloud Storage for Firebase", category: "database", icon: "firebase" },
  { id: "firebasedatabase", name: "Realtime Database", category: "database", icon: "firebase" },
  { id: "firebaseauth", name: "Firebase Authentication", category: "cloud", icon: "firebase" },
  { id: "cloudtasks", name: "Cloud Tasks", category: "cloud", icon: "googlecloud" },
  { id: "pubsub", name: "Pub/Sub", category: "cloud", icon: "googlecloud" },
  { id: "aws", name: "AWS", category: "cloud", npm: ["@aws-sdk/*", "aws-sdk", "aws-cdk-lib"], pypi: ["boto3", "botocore"] },
  { id: "azure", name: "Microsoft Azure", category: "cloud", npm: ["@azure/*", "microsoft-cognitiveservices-speech-sdk"], pypi: ["azure-*", "*[azure]"], facets: { "microsoft-cognitiveservices-speech-sdk": "Speech", "*[azure]": "Speech (extra pip)" } },
  { id: "vercel", name: "Vercel", category: "cloud", icon: "vercel", npm: ["vercel", "@vercel/*"], config: [/(^|\/)vercel\.json$/] },
  { id: "netlify", name: "Netlify", category: "cloud", icon: "netlify", npm: ["netlify-cli", "@netlify/*"], config: [/(^|\/)netlify\.toml$/] },
  { id: "cloudflare", name: "Cloudflare", category: "cloud", icon: "cloudflare", npm: ["wrangler", "@cloudflare/*"], config: [/(^|\/)wrangler\.(toml|jsonc?)$/] },
  { id: "supabase", name: "Supabase", category: "cloud", icon: "supabase", npm: ["@supabase/*"], pypi: ["supabase"] },
  { id: "flyio", name: "Fly.io", category: "cloud", icon: "flydotio", config: [/(^|\/)fly\.toml$/] },
  { id: "terraform", name: "Terraform", category: "ci", icon: "terraform", config: [/\.tf$/] },
  { id: "kubernetes", name: "Kubernetes", category: "ci", icon: "kubernetes", config: [/(^|\/)(k8s|kubernetes|kustomize)\//, /(^|\/)kustomization\.ya?ml$/] },
  { id: "helm", name: "Helm", category: "ci", icon: "helm", config: [/(^|\/)Chart\.yaml$/] },

  // ─── Bases de données ───────────────────────────────────────
  { id: "postgresql", name: "PostgreSQL", category: "database", icon: "postgresql", npm: ["pg", "postgres", "@neondatabase/*"], pypi: ["psycopg*", "asyncpg"], images: ["postgres", "postgis/postgis", "bitnami/postgresql"], system: ["postgresql-client*", "libpq-dev"] },
  { id: "mysql", name: "MySQL", category: "database", icon: "mysql", npm: ["mysql", "mysql2"], pypi: ["mysqlclient", "pymysql"], images: ["mysql"] },
  { id: "mariadb", name: "MariaDB", category: "database", icon: "mariadb", images: ["mariadb"] },
  { id: "mongodb", name: "MongoDB", category: "database", icon: "mongodb", npm: ["mongodb", "mongoose"], pypi: ["pymongo", "motor"], images: ["mongo"] },
  { id: "redis", name: "Redis", category: "database", icon: "redis", npm: ["redis", "ioredis", "@upstash/redis"], pypi: ["redis"], images: ["redis", "bitnami/redis", "valkey/valkey"] },
  { id: "sqlite", name: "SQLite", category: "database", icon: "sqlite", npm: ["better-sqlite3", "sqlite3"], system: ["sqlite3"] },
  { id: "prisma", name: "Prisma", category: "database", icon: "prisma", npm: ["prisma", "@prisma/client"], config: [/(^|\/)schema\.prisma$/] },
  { id: "drizzle", name: "Drizzle ORM", category: "database", icon: "drizzle", npm: ["drizzle-orm", "drizzle-kit"] },
  { id: "sqlalchemy", name: "SQLAlchemy", category: "database", icon: "sqlalchemy", pypi: ["sqlalchemy"] },
  { id: "elasticsearch", name: "Elasticsearch", category: "database", icon: "elasticsearch", npm: ["@elastic/elasticsearch"], images: ["elasticsearch", "elastic/elasticsearch"] },
  { id: "rabbitmq", name: "RabbitMQ", category: "database", icon: "rabbitmq", npm: ["amqplib"], images: ["rabbitmq"] },
  { id: "kafka", name: "Apache Kafka", category: "database", icon: "apachekafka", npm: ["kafkajs"], images: ["confluentinc/cp-kafka", "bitnami/kafka", "apache/kafka"] },
  { id: "minio", name: "MinIO", category: "database", icon: "minio", images: ["minio/minio", "minio"] },

  // ─── IA ─────────────────────────────────────────────────────
  { id: "gemini", name: "Google Gemini", category: "ai", icon: "googlegemini", npm: ["@google/genai", "@google/generative-ai"], pypi: ["google-genai", "google-generativeai"] },
  { id: "vertexai", name: "Vertex AI", category: "ai", icon: "googlecloud", npm: ["@google-cloud/vertexai", "@anthropic-ai/vertex-sdk"], pypi: ["google-cloud-aiplatform"], facets: { "@anthropic-ai/vertex-sdk": "Claude via Vertex" } },
  { id: "anthropic", name: "Anthropic Claude", category: "ai", icon: "anthropic", npm: ["@anthropic-ai/sdk", "@anthropic-ai/vertex-sdk", "@anthropic-ai/*"], pypi: ["anthropic"], facets: { "@anthropic-ai/vertex-sdk": "via Vertex AI" } },
  { id: "openai", name: "OpenAI", category: "ai", npm: ["openai"], pypi: ["openai"] },
  { id: "deepseek", name: "DeepSeek", category: "ai", icon: "deepseek" },
  { id: "mistral", name: "Mistral AI", category: "ai", icon: "mistralai", npm: ["@mistralai/mistralai"], pypi: ["mistralai"] },
  { id: "openrouter", name: "OpenRouter", category: "ai", icon: "openrouter", npm: ["@openrouter/*"] },
  { id: "groq", name: "Groq", category: "ai", npm: ["groq-sdk"], pypi: ["groq"] },
  { id: "elevenlabs", name: "ElevenLabs", category: "ai", icon: "elevenlabs", npm: ["elevenlabs", "@elevenlabs/*"], pypi: ["elevenlabs"] },
  { id: "langchain", name: "LangChain", category: "ai", icon: "langchain", npm: ["langchain", "@langchain/*"], pypi: ["langchain*"] },
  { id: "huggingface", name: "Hugging Face", category: "ai", icon: "huggingface", npm: ["@huggingface/*"], pypi: ["transformers", "huggingface-hub"] },
  { id: "pytorch", name: "PyTorch", category: "ai", icon: "pytorch", pypi: ["torch"] },
  { id: "tensorflow", name: "TensorFlow", category: "ai", icon: "tensorflow", npm: ["@tensorflow/*"], pypi: ["tensorflow"] },

  // ─── Médias, maths & rendu ──────────────────────────────────
  { id: "d3", name: "D3.js", category: "media", icon: "d3", npm: ["d3", "d3-*", "@types/d3"] },
  { id: "recharts", name: "Recharts", category: "media", npm: ["recharts"] },
  { id: "chartjs", name: "Chart.js", category: "media", icon: "chartdotjs", npm: ["chart.js", "react-chartjs-2"] },
  { id: "threejs", name: "Three.js", category: "media", icon: "threedotjs", npm: ["three", "@react-three/*"] },
  { id: "katex", name: "KaTeX", category: "media", npm: ["katex", "@types/katex", "react-katex", "rehype-katex"] },
  { id: "mathlive", name: "MathLive", category: "media", npm: ["mathlive"] },
  { id: "manim", name: "Manim", category: "media", pypi: ["manim", "manim-voiceover", "manimgl"], facets: { "manim-voiceover": "Voiceover" } },
  { id: "ffmpeg", name: "FFmpeg", category: "media", icon: "ffmpeg", npm: ["fluent-ffmpeg", "@ffmpeg/*"], pypi: ["ffmpeg-python"], system: ["ffmpeg"] },
  { id: "sox", name: "SoX", category: "media", system: ["sox", "libsox*"] },
  { id: "cairo", name: "Cairo / Pango", category: "media", icon: "cairographics", system: ["libcairo*", "libpango*"] },
  { id: "imagemagick", name: "ImageMagick", category: "media", system: ["imagemagick"] },
  { id: "chromium", name: "Chromium", category: "media", icon: "googlechrome", system: ["chromium*"], npm: ["puppeteer", "puppeteer-core"] },
  { id: "markdown", name: "Markdown", category: "media", icon: "markdown", npm: ["marked", "markdown-it", "react-markdown", "remark*", "rehype*"] },

  // ─── Build & outillage ──────────────────────────────────────
  { id: "vite", name: "Vite", category: "build", icon: "vite", npm: ["vite", "@vitejs/*", "vite-plugin-*"], config: [/(^|\/)vite\.config\.[cm]?[jt]s$/], facets: { "@vitejs/plugin-react": "plugin React", "vite-plugin-pwa": "plugin PWA" } },
  { id: "esbuild", name: "esbuild", category: "build", icon: "esbuild", npm: ["esbuild"] },
  { id: "tsx", name: "tsx", category: "build", npm: ["tsx", "ts-node"] },
  { id: "webpack", name: "webpack", category: "build", icon: "webpack", npm: ["webpack", "webpack-cli"], config: [/(^|\/)webpack\.config\.[cm]?[jt]s$/] },
  { id: "rollup", name: "Rollup", category: "build", icon: "rollupdotjs", npm: ["rollup", "@rollup/*"] },
  { id: "turborepo", name: "Turborepo", category: "build", icon: "turborepo", npm: ["turbo"], config: [/(^|\/)turbo\.json$/] },
  { id: "nx", name: "Nx", category: "build", icon: "nx", npm: ["nx", "@nx/*"], config: [/(^|\/)nx\.json$/] },
  { id: "babel", name: "Babel", category: "build", icon: "babel", npm: ["@babel/*"], config: [/(^|\/)(\.babelrc|babel\.config\.[cm]?js)$/] },
  { id: "tree-sitter", name: "tree-sitter", category: "build", npm: ["tree-sitter", "tree-sitter-*"] },
  { id: "yaml", name: "YAML", category: "data", icon: "yaml", npm: ["yaml", "js-yaml"], pypi: ["pyyaml"] },

  // ─── Tests ──────────────────────────────────────────────────
  { id: "vitest", name: "Vitest", category: "test", icon: "vitest", npm: ["vitest", "@vitest/*"], config: [/(^|\/)vitest\.config\.[cm]?[jt]s$/] },
  { id: "jest", name: "Jest", category: "test", icon: "jest", npm: ["jest", "@jest/*", "ts-jest"], config: [/(^|\/)jest\.config\.[cm]?[jt]s$/] },
  { id: "playwright", name: "Playwright", category: "test", npm: ["@playwright/test", "playwright"], config: [/(^|\/)playwright\.config\.[cm]?[jt]s$/] },
  { id: "cypress", name: "Cypress", category: "test", icon: "cypress", npm: ["cypress"], config: [/(^|\/)cypress\.config\.[cm]?[jt]s$/] },
  { id: "testing-library", name: "Testing Library", category: "test", icon: "testinglibrary", npm: ["@testing-library/*"] },
  { id: "pytest", name: "pytest", category: "test", icon: "pytest", pypi: ["pytest", "pytest-*"] },

  // ─── Qualité ────────────────────────────────────────────────
  { id: "eslint", name: "ESLint", category: "quality", icon: "eslint", npm: ["eslint", "eslint-*", "@eslint/*", "typescript-eslint", "@typescript-eslint/*"], config: [/(^|\/)(eslint\.config\.[cm]?[jt]s|\.eslintrc(\.[a-z]+)?)$/] },
  { id: "prettier", name: "Prettier", category: "quality", icon: "prettier", npm: ["prettier", "prettier-*"], config: [/(^|\/)\.prettierrc(\.[a-z]+)?$/] },
  { id: "biome", name: "Biome", category: "quality", icon: "biome", npm: ["@biomejs/biome"], config: [/(^|\/)biome\.jsonc?$/] },
  { id: "react-doctor", name: "React Doctor", category: "quality", icon: "react", npm: ["react-doctor"] },
  { id: "ruff", name: "Ruff", category: "quality", icon: "ruff", pypi: ["ruff"] },
  { id: "semgrep", name: "Semgrep", category: "quality", pypi: ["semgrep"], config: [/(^|\/)\.semgrep(\.ya?ml|\/)/] },

  // ─── Analytique & observabilité ─────────────────────────────
  { id: "posthog", name: "PostHog", category: "analytics", icon: "posthog", npm: ["posthog-js", "posthog-node"], pypi: ["posthog"] },
  { id: "sentry", name: "Sentry", category: "analytics", icon: "sentry", npm: ["@sentry/*"], pypi: ["sentry-sdk"] },
  { id: "datadog", name: "Datadog", category: "analytics", icon: "datadog", npm: ["dd-trace", "@datadog/*"], pypi: ["ddtrace"] },
  { id: "opentelemetry", name: "OpenTelemetry", category: "analytics", icon: "opentelemetry", npm: ["@opentelemetry/*"], pypi: ["opentelemetry-*"] },

  // ─── CI/CD & conteneurs ─────────────────────────────────────
  { id: "docker", name: "Docker", category: "ci", icon: "docker", config: [/(^|\/)(Dockerfile[^/]*|[^/]*\.dockerfile|(docker-)?compose[^/]*\.ya?ml|\.dockerignore)$/i] },
  { id: "github-actions", name: "GitHub Actions", category: "ci", icon: "githubactions", config: [/(^|\/)\.github\/workflows\/[^/]+\.ya?ml$/] },
  { id: "gitlab-ci", name: "GitLab CI", category: "ci", icon: "gitlab", config: [/(^|\/)\.gitlab-ci\.ya?ml$/] },
  { id: "nginx", name: "NGINX", category: "ci", icon: "nginx", images: ["nginx", "nginxinc/*", "bitnami/nginx"], system: ["nginx"], config: [/(^|\/)nginx[^/]*\.conf$/] },
  { id: "caddy", name: "Caddy", category: "ci", icon: "caddy", images: ["caddy"], config: [/(^|\/)Caddyfile[^/]*$/] },
  { id: "traefik", name: "Traefik", category: "ci", icon: "traefikproxy", images: ["traefik"], config: [/(^|\/)traefik[^/]*\.(ya?ml|toml)$/] },
  { id: "git-hooks", name: "Git hooks", category: "ci", icon: "git", npm: ["husky", "lint-staged", "simple-git-hooks"], config: [/(^|\/)\.(githooks|husky)\//] },
];

const BY_ID = new Map(CATALOG.map((e) => [e.id, e]));

export function catalogEntry(id: string): CatalogEntry | undefined {
  return BY_ID.get(id);
}

function matches(pattern: string, value: string): boolean {
  if (pattern.startsWith("*[")) return value.endsWith(pattern.slice(1));
  return pattern.endsWith("*") ? value.startsWith(pattern.slice(0, -1)) : pattern === value;
}

/**
 * Toutes les technologies que désigne un paquet (un paquet peut en désigner
 * deux : `@anthropic-ai/vertex-sdk` = Claude ET Vertex AI). Le motif exact
 * l'emporte sur un préfixe.
 */
export function techsForPackage(ecosystem: Ecosystem, name: string): CatalogEntry[] {
  const exact = CATALOG.filter((e) => e[ecosystem]?.includes(name));
  if (exact.length) return exact;
  return CATALOG.filter((e) => e[ecosystem]?.some((p) => (p.endsWith("*") || p.startsWith("*[")) && matches(p, name)));
}

/** Rang du motif qui désigne ce paquet dans l'entrée (0 = paquet principal : `react` avant `react-dom`). */
export function packageRank(entry: CatalogEntry, ecosystem: Ecosystem, name: string): number {
  const list = entry[ecosystem] ?? [];
  const exact = list.indexOf(name);
  if (exact >= 0) return exact;
  const i = list.findIndex((p) => matches(p, name));
  return i >= 0 ? i : list.length;
}

export function techsForImage(image: string): CatalogEntry[] {
  const repo = image.replace(/@sha256:.*$/, "").replace(/:[^/:]+$/, "").replace(/^docker\.io\//, "").replace(/^library\//, "");
  return CATALOG.filter((e) => e.images?.some((p) => matches(p, repo) || (!p.includes("/") && repo.endsWith(`/${p}`))));
}

export function techsForSystemPackage(pkg: string): CatalogEntry[] {
  return CATALOG.filter((e) => e.system?.some((p) => matches(p, pkg)));
}

export function techsForConfig(path: string): CatalogEntry[] {
  return CATALOG.filter((e) => e.config?.some((re) => re.test(path)));
}

/** Facette désignée par un paquet, un import (`firebase/auth`), un fichier ou un rôle d'infra (`infra:host`). */
export function facetFor(entry: CatalogEntry, key: string): string | undefined {
  if (!entry.facets) return undefined;
  if (entry.facets[key]) return entry.facets[key];
  for (const [k, v] of Object.entries(entry.facets)) if (k.startsWith("*[") && key.endsWith(k.slice(1))) return v;
  // `firebase-functions/v2/https` → `firebase-functions/v2` → `firebase-functions`
  for (let k = key; k.includes("/"); ) {
    k = k.slice(0, k.lastIndexOf("/"));
    if (entry.facets[k]) return entry.facets[k];
  }
  return entry.facets[key.slice(key.lastIndexOf("/") + 1)];
}

/** Langage d'une extension de fichier (niveau Technologies : part de chaque langage). */
export const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".php": "php",
  ".rb": "ruby",
  ".java": "java",
  ".kt": "kotlin",
  ".swift": "swift",
  ".cs": "csharp",
  ".html": "html",
  ".css": "css",
  ".scss": "sass",
  ".sass": "sass",
  ".sh": "shell",
  ".bash": "shell",
  ".sql": "sql",
  ".tex": "latex",
};
