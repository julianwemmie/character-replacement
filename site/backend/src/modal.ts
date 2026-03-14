import { readFile } from "fs/promises";
import { ModalClient } from "modal";
import type { QueuedTask } from "./queue";
import { setJobStatus } from "./store";

/**
 * Modal app names matching the deployed Modal apps.
 */
const WAN_MODAL_APP = process.env.WAN_MODAL_APP || "wan-character-replacement";
const SITE_MODAL_APP =
  process.env.SITE_MODAL_APP || "character-replacement-site";

/** Base path on the Modal io volume */
const IO_PATH = "/root/io";

/**
 * Lazily-initialized Modal client — reads MODAL_TOKEN_ID / MODAL_TOKEN_SECRET
 * from the environment.
 */
let _client: ModalClient | null = null;
function getClient(): ModalClient {
  if (!_client) {
    _client = new ModalClient();
  }
  return _client;
}

// ---------------------------------------------------------------------------
// Helper: upload a local file to the Modal io volume via wan-modal's upload_file
// ---------------------------------------------------------------------------
async function uploadFileToVolume(
  localPath: string,
  remotePath: string
): Promise<void> {
  const client = getClient();
  const uploadFn = await client.functions.fromName(
    WAN_MODAL_APP,
    "upload_file"
  );
  const data = await readFile(localPath);
  // upload_file(local_bytes: bytes, remote_path: str)
  await uploadFn.remote([data, remotePath]);
}

// ---------------------------------------------------------------------------
// Helper: download video from URL using the site modal app's yt-dlp function
// ---------------------------------------------------------------------------
async function downloadVideoFromUrl(
  url: string,
  saveDir: string
): Promise<{ path: string }> {
  const client = getClient();
  const downloadFn = await client.functions.fromName(
    SITE_MODAL_APP,
    "download_video"
  );
  // download_video(url: str, save_dir: str) -> dict
  const result = await downloadFn.remote([url, saveDir]);
  return result as { path: string };
}

/**
 * Submit a job to Modal for processing.
 *
 * Flow:
 * 1. Upload video file (or download via URL) and image to the Modal io volume
 * 2. Call preprocess on the wan-modal app
 * 3. Call InferenceRunner.run on the wan-modal app
 * 4. Update job status with output URL
 */
export async function submitToModal(task: QueuedTask): Promise<void> {
  const jobDir = `${IO_PATH}/jobs/${task.jobId}`;
  const videoRemotePath = `${jobDir}/input_video.mp4`;
  const imageRemotePath = `${jobDir}/input_image.png`;
  const preprocessDir = `${jobDir}/preprocess_results`;
  const outputPath = `${jobDir}/output.mp4`;

  console.log(`[modal] Job ${task.jobId}: starting upload phase`);

  try {
    // ---- Step 1: Upload files to Modal volume ----
    await setJobStatus(task.jobId, "preprocessing", { progress: 10 });

    if (
      task.videoPath.startsWith("http://") ||
      task.videoPath.startsWith("https://")
    ) {
      // URL input — download via yt-dlp on Modal
      console.log(
        `[modal] Job ${task.jobId}: downloading video from URL via yt-dlp`
      );
      await downloadVideoFromUrl(task.videoPath, jobDir);
    } else {
      // Local file upload — read and send to Modal volume
      console.log(`[modal] Job ${task.jobId}: uploading video file to volume`);
      await uploadFileToVolume(task.videoPath, videoRemotePath);
    }

    // Upload image file to Modal volume
    console.log(`[modal] Job ${task.jobId}: uploading image file to volume`);
    await uploadFileToVolume(task.imagePath, imageRemotePath);

    await setJobStatus(task.jobId, "preprocessing", { progress: 20 });

    // ---- Step 2: Run preprocessing ----
    console.log(`[modal] Job ${task.jobId}: starting preprocessing`);
    const client = getClient();
    const preprocessFn = await client.functions.fromName(
      WAN_MODAL_APP,
      "preprocess"
    );

    await preprocessFn.remote([], {
      video_path: videoRemotePath,
      refer_path: imageRemotePath,
      save_path: preprocessDir,
      mode: task.mode,
    });

    await setJobStatus(task.jobId, "generating", { progress: 50 });

    // ---- Step 3: Run inference ----
    console.log(`[modal] Job ${task.jobId}: starting inference`);
    const inferenceClass = await client.cls.fromName(
      WAN_MODAL_APP,
      "InferenceRunner"
    );
    const instance = await inferenceClass.instance();
    const runMethod = instance.method("run");

    await runMethod.remote([], {
      src_root_path: preprocessDir,
      save_file: outputPath,
      mode: task.mode,
      video_path: videoRemotePath,
    });

    // ---- Step 4: Mark complete ----
    // Build the output URL that points to the site modal app's serve_file endpoint
    const serveBaseUrl = process.env.MODAL_SERVE_URL || "";
    const relativeOutputPath = `jobs/${task.jobId}/output.mp4`;
    const outputUrl = serveBaseUrl
      ? `${serveBaseUrl}?path=${encodeURIComponent(relativeOutputPath)}`
      : relativeOutputPath;

    await setJobStatus(task.jobId, "done", {
      progress: 100,
      outputUrl,
    });

    console.log(`[modal] Job ${task.jobId}: completed successfully`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[modal] Job ${task.jobId}: failed — ${message}`);
    throw err;
  }
}
