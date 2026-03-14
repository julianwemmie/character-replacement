import type { Job, ApiResponse, PaginatedApiResponse, CreateJobRequest, JobMode } from "@character-replacement/shared";

const API_BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function createJob(data: CreateJobRequest): Promise<ApiResponse<Job>> {
  return request("/jobs", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Create a job by uploading files via multipart form data.
 * Supports progress tracking via XMLHttpRequest.
 */
export async function createJobWithFiles(params: {
  videoFile: File | null;
  videoUrl?: string;
  imageFile: File;
  mode: JobMode;
  onProgress?: (percent: number) => void;
}): Promise<ApiResponse<Job>> {
  const { videoFile, videoUrl, imageFile, mode, onProgress } = params;

  const formData = new FormData();
  formData.append("mode", mode);

  if (videoFile) {
    formData.append("video", videoFile);
  } else if (videoUrl) {
    formData.append("sourceVideoUrl", videoUrl);
  }

  formData.append("image", imageFile);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/jobs`);
    xhr.withCredentials = true;
    // Don't set Content-Type — the browser sets it with the boundary for FormData

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const pct = Math.round((e.loaded / e.total) * 100);
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          reject(new Error(data.error || `HTTP ${xhr.status}`));
        }
      } catch {
        reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error"));
    xhr.ontimeout = () => reject(new Error("Request timed out"));

    xhr.send(formData);
  });
}

export async function getJob(id: string): Promise<ApiResponse<Job>> {
  return request(`/jobs/${id}`);
}

export async function getJobs(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<PaginatedApiResponse<Job>> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));
  if (params?.offset !== undefined) searchParams.set("offset", String(params.offset));
  const qs = searchParams.toString();
  return request(`/jobs${qs ? `?${qs}` : ""}`);
}

/** Fetch all public videos for the explore gallery */
export async function getVideos(params?: {
  limit?: number;
  offset?: number;
}): Promise<PaginatedApiResponse<Job>> {
  const searchParams = new URLSearchParams();
  if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));
  if (params?.offset !== undefined) searchParams.set("offset", String(params.offset));
  const qs = searchParams.toString();
  return request(`/videos${qs ? `?${qs}` : ""}`);
}

/** Fetch video info (public, no auth required) */
export async function getVideo(id: string): Promise<ApiResponse<Job>> {
  return request(`/videos/${id}`);
}

/** Fetch user generation limits */
export async function getUserLimits(): Promise<ApiResponse<{ used: number; max: number }>> {
  return request("/jobs/limits");
}
