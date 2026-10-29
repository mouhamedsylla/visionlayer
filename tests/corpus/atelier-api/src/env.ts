import { z } from "zod";

const Env = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  EMAIL_PROVIDER: z.enum(["resend", "smtp", "console"]).default("resend"),
  RESEND_API_KEY: z.string().optional(),
  SMTP_URL: z.string().optional(),
  SESSION_SECRET: z.string().min(8),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
});

export const env = Env.parse(process.env);
