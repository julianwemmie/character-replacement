/**
 * Standalone migration/seed script.
 *
 * Run with: npx tsx src/seed.ts
 *
 * Creates the jobs table (idempotent). Users are managed by Better Auth.
 */
import { initDb, getDb } from "./db.js";

async function seed(): Promise<void> {
  console.log("[seed] Initializing database schema...");
  await initDb();
  console.log("[seed] Schema ready.");

  const db = getDb();
  const jobs = await db.execute("SELECT * FROM jobs");
  console.log(`[seed] Jobs in database: ${jobs.rows.length}`);

  console.log("[seed] Done.");
}

seed().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
