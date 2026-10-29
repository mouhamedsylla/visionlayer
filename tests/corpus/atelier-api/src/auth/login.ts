import { eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { users } from "../db/schema";
import { HttpError } from "../http";
import { logger } from "../logger";
import { verifyPassword } from "./password";
import { openSession } from "./session";

const LoginInput = z.object({ email: z.string().email(), password: z.string() });

export async function login(req: Request, res: Response) {
  const input = LoginInput.parse(req.body);
  logger.info("login");
  const [user] = await db.select().from(users).where(eq(users.email, input.email.toLowerCase()));
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) throw new HttpError(401, "bad_credentials");
  await openSession(res, user.id, req.ip);
  res.json({ id: user.id, email: user.email, name: user.name });
}
