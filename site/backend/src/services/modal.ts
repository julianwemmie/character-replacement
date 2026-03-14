import type { QueuedJob } from "../queue.js";
import { config } from "../config.js";

/**
 * Submit a job to Modal for processing.
 *
 * This is a placeholder that will be filled in once Modal integration
 * is configured. For now it logs the submission and returns.
 *
 * The actual implementation will call the Modal API to trigger
 * the wan-character-replacement app's preprocess + inference pipeline.
 */
export async function submitToModal(job: QueuedJob): Promise<void> {
  console.log(`[modal] Submitting job ${job.jobId} to Modal app "${config.modal.appName}"`);
  console.log(`[modal] Video: ${job.videoUrl}`);
  console.log(`[modal] Reference image: ${job.referenceImageUrl}`);

  // TODO: Implement Modal API call
  // The Modal app (wan-character-replacement) expects:
  //   - preprocess(video_path, refer_path, save_path, mode)
  //   - InferenceRunner.run(src_root_path, save_file, mode, video_path)
  // Files are stored on the "wan-io" volume mounted at /root/io
  //
  // Steps:
  // 1. Upload video and reference image to Modal volume
  // 2. Call preprocess function
  // 3. Call InferenceRunner.run
  // 4. Modal will call our webhook at POST /api/webhooks/modal on completion
}
