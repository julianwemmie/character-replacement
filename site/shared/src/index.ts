// Shared types for character replacement service

export interface JobRequest {
  sourceVideoUrl: string;
  targetImageUrl: string;
  options?: JobOptions;
}

export interface JobOptions {
  resolution?: string;
}

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface Job {
  id: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  request: JobRequest;
  resultUrl?: string;
  error?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
