// Shared types for character replacement service

export type JobStatus =
  | "queued"
  | "preprocessing"
  | "generating"
  | "done"
  | "failed";

export type JobMode = "replace" | "animate";

export interface JobOptions {
  resolution?: string;
}

export interface CreateJobRequest {
  /** URL to source video (alternative to file upload) */
  sourceVideoUrl?: string;
  /** URL to target image (alternative to file upload) */
  targetImageUrl?: string;
  /** Processing mode */
  mode: JobMode;
  /** Additional options */
  options?: JobOptions;
}

export interface Job {
  id: string;
  status: JobStatus;
  mode: JobMode;
  progress: number;
  outputUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedApiResponse<T> {
  success: boolean;
  data?: T[];
  total?: number;
  error?: string;
}

/** Payload sent by Modal when a job completes */
export interface WebhookPayload {
  job_id: string;
  status: "done" | "failed";
  output_url?: string;
  error?: string;
  progress?: number;
}

/** Maximum allowed video duration in seconds */
export const MAX_VIDEO_DURATION_SECONDS = 15;
