import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { passwordResets, users } from "../db/schema";
import { logger } from "../logger";
import { emailQueue } from "../queue";

const ResetInput = z.object({ email: z.string().email() });

/** Demande de nouveau mot de passe : même réponse que l'adresse existe ou non. */
export async function requestReset(req: Request, res: Response) {
  const { email } = ResetInput.parse(req.body);
  logger.info("password reset requested");
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase()));
  if (user) {
    const token = randomBytes(32).toString("base64url");
    await db.insert(passwordResets).values({ token, userId: user.id, expiresAt: new Date(Date.now() + 3600_000) });
    await emailQueue.add("password-reset", { template: "password-reset", userId: user.id, token });
  }
  res.sendStatus(202);
}
