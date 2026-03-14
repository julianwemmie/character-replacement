import PQueue from "p-queue";
import { updateJobStatus } from "./db.js";
import { config } from "./config.js";
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
} from "./services/modal.js";

const jobQueue = new PQueue({ concurrency: 1 });

export interface QueuedJob {
  jobId: string;
  mode: string;
  /** URL to download video from (YouTube/TikTok/etc.), or local file path from upload. */
  videoSource: string;
  /** Whether videoSource is a URL to download (true) or a local file path (false). */
  isVideoUrl: boolean;
  /** Local file path for the uploaded reference image. */
  referenceImagePath: string;
}

export function enqueueJob(job: QueuedJob): void {
  jobQueue.add(() => processJob(job));
}

async function processJob(job: QueuedJob): Promise<void> {
  const { jobId, mode } = job;

  try {
    // Step 1: Get video onto the Modal volume
    const remoteVideo = jobVideoPath(jobId);
    const remoteImage = jobImagePath(jobId);

    if (job.isVideoUrl) {
      console.log(`[queue] Job ${jobId}: downloading video from URL`);
      await downloadVideo(job.videoSource, remoteVideo);
    } else {
      console.log(`[queue] Job ${jobId}: uploading video file`);
      await uploadLocalFile(job.videoSource, remoteVideo);
    }

    // Step 2: Upload reference image
    console.log(`[queue] Job ${jobId}: uploading reference image`);
    await uploadLocalFile(job.referenceImagePath, remoteImage);

    // Step 3: Preprocessing
    console.log(`[queue] Job ${jobId}: starting preprocessing`);
    await updateJobStatus(jobId, "preprocessing");
    await runPreprocess({
      videoPath: remoteVideo,
      referPath: remoteImage,
      savePath: jobPreprocessPath(jobId),
      mode,
    });

    // Step 4: Inference
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

    // Step 5: Done
    const outputUrl = buildOutputUrl(jobId);
    console.log(`[queue] Job ${jobId}: complete -> ${outputUrl}`);
    await updateJobStatus(jobId, "done", outputUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[queue] Job ${jobId} failed:`, message);
    await updateJobStatus(jobId, "failed", undefined, message);
  }
}

export function getQueueSize(): number {
  return jobQueue.size + jobQueue.pending;
}
