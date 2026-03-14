/**
 * Standalone migration/seed script.
 *
 * Run with: npx tsx src/seed.ts
 *
 * Creates the users and jobs tables (idempotent) and optionally
 * inserts a sample user for local development.
 */
import { initDb, upsertUser, getDb } from "./db.js";

async function seed(): Promise<void> {
  console.log("[seed] Initializing database schema...");
  await initDb();
  console.log("[seed] Schema ready.");

  // Insert a sample dev user so local testing works out of the box
  await upsertUser("dev-user", "dev@example.com", "Dev User");
  console.log("[seed] Sample user 'dev-user' upserted.");

  const db = getDb();
  const users = await db.execute("SELECT * FROM users");
  console.log(`[seed] Users in database: ${users.rows.length}`);

  const jobs = await db.execute("SELECT * FROM jobs");
  console.log(`[seed] Jobs in database: ${jobs.rows.length}`);

  console.log("[seed] Done.");
}

seed().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
