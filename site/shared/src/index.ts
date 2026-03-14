export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface Job {
  id: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface CreateJobRequest {
  videoUrl: string;
  sourceCharacterImage: string;
  targetCharacterImage: string;
}

export interface CreateJobResponse {
  job: Job;
}

export interface GetJobResponse {
  job: Job;
  outputUrl?: string;
}
