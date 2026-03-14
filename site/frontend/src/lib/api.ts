import type {
  CreateJobResponse,
  GetJobResponse,
  GetMeResponse,
  ListJobsResponse,
} from "@character-replacement/shared";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options);
  if (!res.ok) {
    const body = await res.text().catch(() => "Unknown error");
    throw new ApiError(res.status, body);
  }
  return res.json() as Promise<T>;
}

function jsonRequest<T>(path: string, options?: RequestInit): Promise<T> {
  return request<T>(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
}

export const api = {
  me: () => jsonRequest<GetMeResponse>("/api/me"),
  jobs: {
    list: () => jsonRequest<ListJobsResponse>("/api/jobs"),
    get: (id: string) => jsonRequest<GetJobResponse>(`/api/jobs/${id}`),
    create: (formData: FormData) =>
      request<CreateJobResponse>("/api/jobs", { method: "POST", body: formData }),
  },
  explore: {
    list: () => jsonRequest<ListJobsResponse>("/api/explore"),
  },
};

export { ApiError };
