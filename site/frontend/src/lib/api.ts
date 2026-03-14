import type { Job, ApiResponse, CreateJobRequest } from "@character-replacement/shared";

const API_BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
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

export async function getJob(id: string): Promise<ApiResponse<Job>> {
  return request(`/jobs/${id}`);
}

export async function getJobs(): Promise<ApiResponse<Job[]>> {
  return request("/jobs");
}

export async function getMe(): Promise<ApiResponse<{ id: string; email: string; name: string }>> {
  return request("/auth/me");
}

export function loginWithGoogle(): void {
  window.location.href = `${API_BASE}/auth/google`;
}

export async function logout(): Promise<void> {
  await request("/auth/logout", { method: "POST" });
}
