import { createClient, type Client } from "@libsql/client";
import { config } from "./config.js";

let db: Client;

export function getDb(): Client {
  if (!db) {
    db = createClient({
      url: config.turso.url,
      authToken: config.turso.authToken || undefined,
    });
  }
  return db;
}

export async function initDb(): Promise<void> {
  const client = getDb();

  await client.batch([
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      generations_used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      video_url TEXT,
      reference_image_url TEXT,
      output_url TEXT,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
  ]);
}
