export type JobStatus = "queued" | "preprocessing" | "generating" | "done" | "failed";

export type JobMode = "replace" | "animate";

export interface Job {
  id: string;
  userId: string;
  status: JobStatus;
  mode: JobMode;
  videoUrl?: string;
  referenceImageUrl?: string;
  outputUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  generationCount: number;
  createdAt: string;
}

export interface CreateJobRequest {
  videoUrl?: string;
  mode?: JobMode;
}

export interface CreateJobResponse {
  job: Job;
}

export interface GetJobResponse {
  job: Job;
}

export interface ListJobsResponse {
  jobs: Job[];
}

export interface GetMeResponse {
  user: User;
}

export interface WebhookPayload {
  jobId: string;
  status: "done" | "failed";
  outputUrl?: string;
  error?: string;
}
