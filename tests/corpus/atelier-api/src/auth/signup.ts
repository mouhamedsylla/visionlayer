import type { Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { users } from "../db/schema";
import { HttpError } from "../http";
import { logger } from "../logger";
import { hashPassword } from "./password";
import { openSession } from "./session";

const SignupInput = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  phone: z.string().optional(),
  password: z.string().min(10),
});

export async function signup(req: Request, res: Response) {
  const input = SignupInput.parse(req.body);
  logger.info({ body: req.body }, "signup");
  const user = await createUser(input);
  await openSession(res, user.id, req.ip);
  res.status(201).json({ id: user.id, email: user.email, name: user.name });
}

async function createUser(input: z.infer<typeof SignupInput>) {
  const passwordHash = await hashPassword(input.password);
  const [user] = await db
    .insert(users)
    .values({ email: input.email.toLowerCase(), name: input.name, phone: input.phone, passwordHash })
    .onConflictDoNothing()
    .returning();
  if (!user) throw new HttpError(409, "email_taken");
  return user;
}
