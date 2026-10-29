import type { Request, Response } from "express";
import { pool } from "./db";

export async function health(_req: Request, res: Response) {
  await pool.query("select 1");
  res.json({ ok: true });
}
