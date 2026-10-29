import { readFileSync } from "node:fs";
import { db } from "../db";
import { workshops } from "../db/schema";

/** Import des ateliers depuis l'ancien tableur (migration de mars). */
export async function importCsv(path: string, instructorId: string) {
  const lines = readFileSync(path, "utf8").split("\n").slice(1).filter(Boolean);
  for (const line of lines) {
    const [title, description] = line.split(";");
    if (!title || !description) continue;
    await db.insert(workshops).values({ title, description, instructorId, published: false });
  }
  return lines.length;
}
