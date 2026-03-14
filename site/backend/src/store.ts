import type { Job, JobStatus } from "@character-replacement/shared";

/** In-memory job store */
const jobs = new Map<string, Job>();

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function getAllJobs(): Job[] {
  return Array.from(jobs.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function createJob(job: Job): void {
  jobs.set(job.id, job);
}

export function updateJob(
  id: string,
  updates: Partial<Pick<Job, "status" | "progress" | "outputUrl" | "error">>
): Job | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;

  const updated: Job = {
    ...job,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  jobs.set(id, updated);
  return updated;
}

export function setJobStatus(
  id: string,
  status: JobStatus,
  extra?: { progress?: number; outputUrl?: string; error?: string }
): Job | undefined {
  return updateJob(id, { status, ...extra });
}
