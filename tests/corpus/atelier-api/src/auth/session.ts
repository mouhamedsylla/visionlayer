import { randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { Request, Response } from "express";
import { SESSION_DAYS } from "../config";
import { db } from "../db";
import { sessions, users } from "../db/schema";
import { HttpError } from "../http";

export type User = typeof users.$inferSelect;

const COOKIE = "sid";

export async function openSession(res: Response, userId: string, ip: string | undefined) {
  const id = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  await db.insert(sessions).values({ id, userId, ip, expiresAt });
  res.cookie(COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", expires: expiresAt });
}

/** L'utilisateur de la requête, ou 401. */
export async function requireUser(req: Request): Promise<User> {
  const sid = req.cookies?.[COOKIE];
  if (!sid) throw new HttpError(401, "unauthenticated");
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sid), gt(sessions.expiresAt, new Date())));
  if (!row) throw new HttpError(401, "unauthenticated");
  return row.user;
}

export async function requireAdmin(req: Request): Promise<User> {
  const user = await requireUser(req);
  if (user.role !== "admin") throw new HttpError(403, "forbidden");
  return user;
}
