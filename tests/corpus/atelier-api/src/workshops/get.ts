import { and, eq, gt } from "drizzle-orm";
import type { Request, Response } from "express";
import { db } from "../db";
import { slots, workshops } from "../db/schema";
import { HttpError } from "../http";

export async function getWorkshop(req: Request, res: Response) {
  const [workshop] = await db.select().from(workshops).where(and(eq(workshops.id, req.params.id!), eq(workshops.published, true)));
  if (!workshop) throw new HttpError(404, "not_found");
  const upcoming = await db.select().from(slots).where(and(eq(slots.workshopId, workshop.id), gt(slots.startsAt, new Date())));
  res.json({ ...workshop, slots: upcoming });
}
