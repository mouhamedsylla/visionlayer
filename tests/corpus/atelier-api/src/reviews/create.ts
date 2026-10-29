import type { Request, Response } from "express";
import { z } from "zod";
import { requireUser } from "../auth/session";
import { db } from "../db";
import { reviews } from "../db/schema";

const CreateReview = z.object({ workshopId: z.string().uuid(), rating: z.number().int().min(1).max(5), comment: z.string().max(2000).optional() });

export async function createReview(req: Request, res: Response) {
  const user = await requireUser(req);
  const input = CreateReview.parse(req.body);
  const [review] = await db.insert(reviews).values({ ...input, userId: user.id }).returning();
  res.status(201).json(review);
}
