import PQueue from "p-queue";
import { getDb } from "./db.js";
import { submitToModal } from "./services/modal.js";

const jobQueue = new PQueue({ concurrency: 1 });

export interface QueuedJob {
  jobId: string;
  videoUrl: string;
  referenceImageUrl: string;
}

export function enqueueJob(job: QueuedJob): void {
  jobQueue.add(() => processJob(job));
}

async function processJob(job: QueuedJob): Promise<void> {
  const db = getDb();

  await db.execute({
    sql: "UPDATE jobs SET status = 'processing', updated_at = datetime('now') WHERE id = ?",
    args: [job.jobId],
  });

  try {
    await submitToModal(job);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await db.execute({
      sql: "UPDATE jobs SET status = 'failed', error = ?, updated_at = datetime('now') WHERE id = ?",
      args: [message, job.jobId],
    });
  }
}

export function getQueueSize(): number {
  return jobQueue.size + jobQueue.pending;
}
