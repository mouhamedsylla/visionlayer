import { lt } from "drizzle-orm";
import { db } from "../db";
import { sessions } from "../db/schema";

/** Chaque nuit : les sessions expirées (30 jours) sont supprimées. */
export async function purgeSessions() {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
