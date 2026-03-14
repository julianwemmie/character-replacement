import PQueue from "p-queue";
import { updateJobStatus } from "./db.js";
import { config } from "./config.js";
import { sendVideoReadyEmail, sendVideoFailedEmail } from "./services/email.js";
import {
  downloadVideo,
  uploadLocalFile,
  runPreprocess,
  runInference,
  jobVideoPath,
  jobImagePath,
  jobPreprocessPath,
  jobOutputPath,
  buildOutputUrl,
  buildThumbnailUrl,
} from "./services/modal.js";

const jobQueue = new PQueue({ concurrency: 1 });

export interface QueuedJob {
  jobId: string;
  mode: string;
  videoSource: string;
  isVideoUrl: boolean;
  referenceImagePath: string;
  userEmail?: string;
  userName?: string;
}

export function enqueueJob(job: QueuedJob): void {
  jobQueue.add(() => processJob(job));
}

async function processJob(job: QueuedJob): Promise<void> {
  const { jobId, mode } = job;

  try {
    const remoteVideo = jobVideoPath(jobId);
    const remoteImage = jobImagePath(jobId);

    if (job.isVideoUrl) {
      console.log(`[queue] Job ${jobId}: downloading video from URL`);
      await downloadVideo(job.videoSource, remoteVideo);
    } else {
      console.log(`[queue] Job ${jobId}: uploading video file`);
      await uploadLocalFile(job.videoSource, remoteVideo);
    }

    console.log(`[queue] Job ${jobId}: uploading reference image`);
    await uploadLocalFile(job.referenceImagePath, remoteImage);

    console.log(`[queue] Job ${jobId}: starting preprocessing`);
    await updateJobStatus(jobId, "preprocessing");
    await runPreprocess({
      videoPath: remoteVideo,
      referPath: remoteImage,
      savePath: jobPreprocessPath(jobId),
      mode,
    });

    console.log(`[queue] Job ${jobId}: starting inference`);
    await updateJobStatus(jobId, "generating");
    const webhookUrl = `${config.auth.url}/api/webhooks/modal`;
    await runInference({
      srcRootPath: jobPreprocessPath(jobId),
      saveFile: jobOutputPath(jobId),
      mode,
      videoPath: remoteVideo,
      webhookUrl,
      jobId,
      webhookSecret: config.webhookSecret || undefined,
    });

    const outputUrl = buildOutputUrl(jobId);
    const thumbnailUrl = buildThumbnailUrl(jobId);
    console.log(`[queue] Job ${jobId}: complete -> ${outputUrl}`);
    await updateJobStatus(jobId, "done", outputUrl, undefined, thumbnailUrl);
    await notifyUser(job, "done", outputUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[queue] Job ${jobId} failed:`, message);
    await updateJobStatus(jobId, "failed", undefined, message);
    await notifyUser(job, "failed", undefined, message);
  }
}

async function notifyUser(
  job: QueuedJob,
  status: "done" | "failed",
  outputUrl?: string,
  error?: string,
): Promise<void> {
  try {
    if (!job.userEmail) return;
    const name = job.userName || "there";
    if (status === "done") {
      await sendVideoReadyEmail(job.userEmail, name, job.jobId, outputUrl || "");
    } else {
      await sendVideoFailedEmail(job.userEmail, name, job.jobId, error || "Unknown error");
    }
  } catch (err) {
    console.error(`[queue] Failed to send notification for job ${job.jobId}:`, err);
  }
}

export { notifyUser };

export function getQueueSize(): number {
  return jobQueue.size + jobQueue.pending;
}
