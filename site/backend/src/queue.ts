import PQueue from "p-queue";
import { updateJobStatus } from "./db.js";
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
  await updateJobStatus(job.jobId, "preprocessing");

  try {
    await submitToModal(job);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await updateJobStatus(job.jobId, "failed", undefined, message);
  }
}

export function getQueueSize(): number {
  return jobQueue.size + jobQueue.pending;
}
