import type { Request, Response } from "express";
import { requireUser } from "../auth/session";
import { db } from "../db";
import { users } from "../db/schema";

/** Export CSV des clients, pour la compta. */
export async function exportUsers(req: Request, res: Response) {
  await requireUser(req);
  const rows = await db.select({ email: users.email, name: users.name, phone: users.phone, createdAt: users.createdAt }).from(users);
  const csv = ["email,name,phone,created_at", ...rows.map((r) => [r.email, r.name, r.phone ?? "", r.createdAt.toISOString()].join(","))].join("\n");
  res.type("text/csv").send(csv);
}
