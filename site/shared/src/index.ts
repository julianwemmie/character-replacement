export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface Job {
  id: string;
  userId: string;
  status: JobStatus;
  videoUrl?: string;
  referenceImageUrl?: string;
  outputUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJobRequest {
  videoUrl?: string;
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

export interface WebhookPayload {
  jobId: string;
  status: "completed" | "failed";
  outputUrl?: string;
  error?: string;
}
