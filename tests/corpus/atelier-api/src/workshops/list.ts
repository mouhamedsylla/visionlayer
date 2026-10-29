import { eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { db } from "../db";
import { instructors, users, workshops } from "../db/schema";

export async function listWorkshops(_req: Request, res: Response) {
  const rows = await db
    .select({ id: workshops.id, title: workshops.title, instructor: users.name })
    .from(workshops)
    .innerJoin(instructors, eq(instructors.id, workshops.instructorId))
    .innerJoin(users, eq(users.id, instructors.userId))
    .where(eq(workshops.published, true));
  res.json(rows);
}
