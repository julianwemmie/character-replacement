import type { Job, JobStatus } from "@character-replacement/shared";
import { getTursoClient, isTursoConfigured } from "./db";

// ---------------------------------------------------------------------------
// In-memory fallback store
// ---------------------------------------------------------------------------
const memoryJobs = new Map<string, Job>();

// ---------------------------------------------------------------------------
// Turso helpers
// ---------------------------------------------------------------------------

interface JobRow {
  id: string;
  user_id: string | null;
  status: string;
  mode: string;
  source_video_url: string | null;
  source_image_url: string | null;
  output_url: string | null;
  error: string | null;
  progress: number;
  is_public: number;
  created_at: string;
  updated_at: string;
}

function rowToJob(row: JobRow): Job {
  return {
    id: row.id,
    status: row.status as Job["status"],
    mode: row.mode as Job["mode"],
    progress: row.progress,
    outputUrl: row.output_url ?? undefined,
    error: row.error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Public API — delegates to Turso or in-memory depending on config
// ---------------------------------------------------------------------------

export async function getJob(id: string): Promise<Job | undefined> {
  if (!isTursoConfigured()) {
    return memoryJobs.get(id);
  }

  const client = getTursoClient()!;
  const result = await client.execute({
    sql: "SELECT * FROM jobs WHERE id = ?",
    args: [id],
  });

  if (result.rows.length === 0) return undefined;
  return rowToJob(result.rows[0] as unknown as JobRow);
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export async function getAllJobs(
  userId?: string,
  options?: { status?: string; limit?: number; offset?: number }
): Promise<PaginatedResult<Job>> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const statusFilter = options?.status;

  if (!isTursoConfigured()) {
    let all = Array.from(memoryJobs.values());
    all.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (statusFilter) {
      all = all.filter((j) => j.status === statusFilter);
    }
    const total = all.length;
    return { items: all.slice(offset, offset + limit), total };
  }

  const client = getTursoClient()!;
  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (userId) {
    conditions.push("user_id = ?");
    args.push(userId);
  } else {
    conditions.push("is_public = 1");
  }

  if (statusFilter) {
    conditions.push("status = ?");
    args.push(statusFilter);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await client.execute({
    sql: `SELECT COUNT(*) as cnt FROM jobs ${where}`,
    args,
  });
  const total = Number(countResult.rows[0]?.cnt ?? 0);

  const dataResult = await client.execute({
    sql: `SELECT * FROM jobs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    args: [...args, limit, offset],
  });

  return {
    items: dataResult.rows.map((row) => rowToJob(row as unknown as JobRow)),
    total,
  };
}

/**
 * Get all public completed jobs (for explore/gallery page).
 */
export async function getPublicJobs(options?: {
  limit?: number;
  offset?: number;
}): Promise<PaginatedResult<Job>> {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  if (!isTursoConfigured()) {
    const all = Array.from(memoryJobs.values())
      .filter((j) => j.status === "done")
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    return { items: all.slice(offset, offset + limit), total: all.length };
  }

  const client = getTursoClient()!;

  const countResult = await client.execute(
    "SELECT COUNT(*) as cnt FROM jobs WHERE status = 'done' AND is_public = 1"
  );
  const total = Number(countResult.rows[0]?.cnt ?? 0);

  const dataResult = await client.execute({
    sql: "SELECT * FROM jobs WHERE status = 'done' AND is_public = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?",
    args: [limit, offset],
  });

  return {
    items: dataResult.rows.map((row) => rowToJob(row as unknown as JobRow)),
    total,
  };
}

export async function createJob(job: Job, userId?: string): Promise<void> {
  if (!isTursoConfigured()) {
    memoryJobs.set(job.id, job);
    return;
  }

  const client = getTursoClient()!;
  await client.execute({
    sql: `INSERT INTO jobs (id, user_id, status, mode, progress, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      job.id,
      userId ?? null,
      job.status,
      job.mode,
      job.progress,
      job.createdAt,
      job.updatedAt,
    ],
  });
}

export async function updateJob(
  id: string,
  updates: Partial<Pick<Job, "status" | "progress" | "outputUrl" | "error">>
): Promise<Job | undefined> {
  if (!isTursoConfigured()) {
    const job = memoryJobs.get(id);
    if (!job) return undefined;
    const updated: Job = {
      ...job,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    memoryJobs.set(id, updated);
    return updated;
  }

  const client = getTursoClient()!;
  const setClauses: string[] = ["updated_at = datetime('now')"];
  const args: (string | number | null)[] = [];

  if (updates.status !== undefined) {
    setClauses.push("status = ?");
    args.push(updates.status);
  }
  if (updates.progress !== undefined) {
    setClauses.push("progress = ?");
    args.push(updates.progress);
  }
  if (updates.outputUrl !== undefined) {
    setClauses.push("output_url = ?");
    args.push(updates.outputUrl);
  }
  if (updates.error !== undefined) {
    setClauses.push("error = ?");
    args.push(updates.error);
  }

  args.push(id);
  await client.execute({
    sql: `UPDATE jobs SET ${setClauses.join(", ")} WHERE id = ?`,
    args,
  });

  return getJob(id);
}

export async function setJobStatus(
  id: string,
  status: JobStatus,
  extra?: { progress?: number; outputUrl?: string; error?: string }
): Promise<Job | undefined> {
  return updateJob(id, { status, ...extra });
}
