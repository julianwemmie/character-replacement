import PQueue from "p-queue";
import { setJobStatus } from "./store";
import { submitToModal } from "./modal";

/** Job processing queue with concurrency of 1 */
const queue = new PQueue({ concurrency: 1 });

export interface QueuedTask {
  jobId: string;
  videoPath: string;
  imagePath: string;
  mode: "replace" | "animate";
}

/**
 * Enqueue a job for processing. The queue ensures only one job
 * is sent to Modal at a time.
 */
export function enqueueJob(task: QueuedTask): void {
  queue
    .add(async () => {
      try {
        await setJobStatus(task.jobId, "preprocessing", { progress: 10 });
        await submitToModal(task);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`Job ${task.jobId} failed:`, message);
        await setJobStatus(task.jobId, "failed", { error: message });
      }
    })
    .catch((err) => {
      console.error(`Queue error for job ${task.jobId}:`, err);
    });
}

export function getQueueSize(): number {
  return queue.size + queue.pending;
}
