import type {
  CreateJobRequest,
  CreateJobResponse,
  GetJobResponse,
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
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "Unknown error");
    throw new ApiError(res.status, body);
  }
  return res.json() as Promise<T>;
}

export const api = {
  jobs: {
    list: () => request<ListJobsResponse>("/api/jobs"),
    get: (id: string) => request<GetJobResponse>(`/api/jobs/${id}`),
    create: (data: CreateJobRequest) =>
      request<CreateJobResponse>("/api/jobs", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
};

export { ApiError };
