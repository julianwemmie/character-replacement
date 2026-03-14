import type { QueuedTask } from "./queue";
import { setJobStatus } from "./store";

/**
 * Modal API configuration.
 * In production, these would come from environment variables.
 */
const MODAL_API_URL =
  process.env.MODAL_API_URL || "https://your-modal-app.modal.run";
const MODAL_AUTH_TOKEN = process.env.MODAL_AUTH_TOKEN || "";

/**
 * Submit a job to Modal for processing.
 * This makes an HTTP call to the Modal-deployed inference endpoint.
 *
 * The Modal function is expected to:
 * 1. Download the video and image from the provided paths/URLs
 * 2. Run preprocessing (face detection, frame extraction)
 * 3. Run the character replacement/animation inference
 * 4. Upload the result and call back via the webhook
 */
export async function submitToModal(task: QueuedTask): Promise<void> {
  const payload = {
    job_id: task.jobId,
    video_path: task.videoPath,
    image_path: task.imagePath,
    mode: task.mode,
    callback_url: `${process.env.PUBLIC_URL || "http://localhost:3001"}/api/webhooks/modal`,
  };

  console.log(`Submitting job ${task.jobId} to Modal:`, {
    mode: task.mode,
    url: `${MODAL_API_URL}/process`,
  });

  // Update status to show we're sending to Modal
  await setJobStatus(task.jobId, "preprocessing", { progress: 20 });

  try {
    const response = await fetch(`${MODAL_API_URL}/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(MODAL_AUTH_TOKEN
          ? { Authorization: `Bearer ${MODAL_AUTH_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Modal API returned ${response.status}: ${body.slice(0, 200)}`
      );
    }

    // Modal accepted the job; it will call back via webhook when done
    await setJobStatus(task.jobId, "generating", { progress: 30 });
    console.log(`Job ${task.jobId} accepted by Modal`);
  } catch (err) {
    if (
      err instanceof TypeError &&
      (err.message.includes("fetch") || err.message.includes("ECONNREFUSED"))
    ) {
      throw new Error(
        "Cannot connect to Modal API. Ensure MODAL_API_URL is configured."
      );
    }
    throw err;
  }
}
