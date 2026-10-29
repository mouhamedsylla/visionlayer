import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "./logger";

export class HttpError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

/** Express 4 ne rattrape pas les promesses rejetées : chaque route passe par ici. */
export const route =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.code });
  if (err instanceof ZodError) return res.status(400).json({ error: "invalid_input", issues: err.issues });
  logger.error({ err, path: req.path }, "unhandled");
  res.status(500).json({ error: "internal" });
}
