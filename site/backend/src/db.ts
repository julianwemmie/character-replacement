import { createClient, type Client } from "@libsql/client";
import type { Job, JobMode, JobStatus } from "@character-replacement/shared";
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
    `CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      mode TEXT NOT NULL DEFAULT 'replace',
      video_url TEXT,
      reference_image_url TEXT,
      output_url TEXT,
      thumbnail_url TEXT,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES user(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)`,
  ]);
}

// ---------------------------------------------------------------------------
// Generation count (derived from jobs table)
// ---------------------------------------------------------------------------

export async function getGenerationCount(userId: string): Promise<number> {
  const result = await getDb().execute({
    sql: "SELECT COUNT(*) as count FROM jobs WHERE user_id = ?",
    args: [userId],
  });
  return (result.rows[0]?.count as number) ?? 0;
}

// ---------------------------------------------------------------------------
// Job helpers
// ---------------------------------------------------------------------------

function rowToJob(row: Record<string, unknown>): Job {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    status: row.status as JobStatus,
    mode: (row.mode as JobMode) || "replace",
    videoUrl: (row.video_url as string) || undefined,
    referenceImageUrl: (row.reference_image_url as string) || undefined,
    outputUrl: (row.output_url as string) || undefined,
    thumbnailUrl: (row.thumbnail_url as string) || undefined,
    error: (row.error as string) || undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getJob(id: string): Promise<Job | null> {
  const result = await getDb().execute({ sql: "SELECT * FROM jobs WHERE id = ?", args: [id] });
  return result.rows.length > 0 ? rowToJob(result.rows[0]) : null;
}

export async function getJobsByUser(userId: string): Promise<Job[]> {
  const result = await getDb().execute({
    sql: "SELECT * FROM jobs WHERE user_id = ? ORDER BY created_at DESC",
    args: [userId],
  });
  return result.rows.map(rowToJob);
}

export async function createJob(params: {
  id: string;
  userId: string;
  mode: JobMode;
  videoUrl: string;
  referenceImageUrl: string;
}): Promise<Job> {
  const now = new Date().toISOString();
  await getDb().execute({
    sql: `INSERT INTO jobs (id, user_id, status, mode, video_url, reference_image_url, created_at, updated_at)
          VALUES (?, ?, 'queued', ?, ?, ?, ?, ?)`,
    args: [params.id, params.userId, params.mode, params.videoUrl, params.referenceImageUrl, now, now],
  });

  return {
    id: params.id,
    userId: params.userId,
    status: "queued",
    mode: params.mode,
    videoUrl: params.videoUrl,
    referenceImageUrl: params.referenceImageUrl,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateJobStatus(
  id: string,
  status: JobStatus,
  outputUrl?: string,
  error?: string,
  thumbnailUrl?: string,
): Promise<void> {
  await getDb().execute({
    sql: `UPDATE jobs SET status = ?, output_url = COALESCE(?, output_url), thumbnail_url = COALESCE(?, thumbnail_url), error = COALESCE(?, error), updated_at = datetime('now') WHERE id = ?`,
    args: [status, outputUrl ?? null, thumbnailUrl ?? null, error ?? null, id],
  });
}

export async function getPublicVideos(): Promise<Job[]> {
  const result = await getDb().execute(
    "SELECT * FROM jobs WHERE status = 'done' ORDER BY created_at DESC",
  );
  return result.rows.map(rowToJob);
}
