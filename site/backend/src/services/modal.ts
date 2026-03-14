import { readFile } from "fs/promises";
import { ModalClient } from "modal";
import { config } from "../config.js";

/** Shared Modal client instance (reads MODAL_TOKEN_ID / MODAL_TOKEN_SECRET from env). */
let client: ModalClient | undefined;

function getClient(): ModalClient {
  if (!client) {
    client = new ModalClient();
  }
  return client;
}

// ---------------------------------------------------------------------------
// App names — must match the deployed Modal apps
// ---------------------------------------------------------------------------
const WAN_APP = "wan-character-replacement";
const SITE_APP = "character-replacement-site";

// ---------------------------------------------------------------------------
// Remote path helpers
// ---------------------------------------------------------------------------
const IO_ROOT = "/root/io";

export function jobDir(jobId: string): string {
  return `${IO_ROOT}/jobs/${jobId}`;
}

export function jobVideoPath(jobId: string): string {
  return `${jobDir(jobId)}/input_video.mp4`;
}

export function jobImagePath(jobId: string): string {
  return `${jobDir(jobId)}/input_image.png`;
}

export function jobPreprocessPath(jobId: string): string {
  return `${jobDir(jobId)}/preprocess_results`;
}

export function jobOutputPath(jobId: string): string {
  return `${jobDir(jobId)}/output.mp4`;
}

// ---------------------------------------------------------------------------
// Modal function wrappers
// ---------------------------------------------------------------------------

/**
 * Download a video from a URL (YouTube, TikTok, etc.) to the Modal io volume
 * via the site app's yt-dlp function.
 */
export async function downloadVideo(
  url: string,
  destPath: string,
): Promise<{ path: string; duration: number; width: number; height: number; file_size: number }> {
  const modal = getClient();
  const fn = await modal.functions.fromName(SITE_APP, "download_video");
  return await fn.remote([url, destPath]);
}

/**
 * Upload raw bytes to the Modal io volume via the wan app's upload_file function.
 */
export async function uploadFile(fileBytes: Uint8Array, remotePath: string): Promise<void> {
  const modal = getClient();
  const fn = await modal.functions.fromName(WAN_APP, "upload_file");
  await fn.remote([fileBytes, remotePath]);
}

/**
 * Upload a local file (by path) to the Modal io volume.
 */
export async function uploadLocalFile(localPath: string, remotePath: string): Promise<void> {
  const fileBytes = await readFile(localPath);
  await uploadFile(new Uint8Array(fileBytes), remotePath);
}

/**
 * Run Wan2.2 preprocessing on the Modal volume.
 */
export async function runPreprocess(params: {
  videoPath: string;
  referPath: string;
  savePath: string;
  mode: string;
}): Promise<void> {
  const modal = getClient();
  const fn = await modal.functions.fromName(WAN_APP, "preprocess");
  await fn.remote([], {
    video_path: params.videoPath,
    refer_path: params.referPath,
    save_path: params.savePath,
    mode: params.mode,
  });
}

/**
 * Run Wan2.2 inference via the InferenceRunner class on Modal.
 */
export async function runInference(params: {
  srcRootPath: string;
  saveFile: string;
  mode: string;
  videoPath: string;
}): Promise<void> {
  const modal = getClient();
  const cls = await modal.cls.fromName(WAN_APP, "InferenceRunner");
  const instance = await cls.instance();
  const run = instance.method("run");
  await run.remote([], {
    src_root_path: params.srcRootPath,
    save_file: params.saveFile,
    mode: params.mode,
    video_path: params.videoPath,
  });
}

// ---------------------------------------------------------------------------
// Output URL construction
// ---------------------------------------------------------------------------

/**
 * Build the public URL for a completed job's output video.
 *
 * The site Modal app exposes a `serve_file` web endpoint that serves files
 * from the io volume. The path query param is relative to /root/io.
 */
export function buildOutputUrl(jobId: string): string {
  // Modal web endpoints follow the pattern:
  // https://<workspace>--<app-name>-<function-name>.modal.run
  // We store this base URL in config; fall back to a placeholder.
  const base = config.modal.serveEndpoint || "https://character-replacement-site-serve-file.modal.run";
  const relativePath = `jobs/${jobId}/output.mp4`;
  return `${base}?path=${encodeURIComponent(relativePath)}`;
}
