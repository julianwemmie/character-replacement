import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Job, JobStatus } from "@character-replacement/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";

function formatDate(date: string): string {
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatElapsed(start: string, end?: string): string {
  const from = new Date(start).getTime();
  const to = end ? new Date(end).getTime() : Date.now();
  const seconds = Math.floor((to - from) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

function statusLabel(status: JobStatus): string {
  const labels: Record<JobStatus, string> = {
    queued: "Queued",
    preprocessing: "Preprocessing",
    generating: "Generating",
    done: "Done",
    failed: "Failed",
  };
  return labels[status];
}

function isTerminal(status: JobStatus): boolean {
  return status === "done" || status === "failed";
}

function JobRow({ job }: { job: Job }) {
  const terminal = isTerminal(job.status);
  const elapsed = formatElapsed(job.createdAt, terminal ? job.updatedAt : undefined);

  return (
    <div className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0">
      <Badge variant={job.status} className="w-28 justify-center">
        {statusLabel(job.status)}
      </Badge>

      <span className="w-20 text-sm capitalize text-muted-foreground">
        {job.mode}
      </span>

      <span className="hidden text-sm text-muted-foreground sm:block">
        {formatDate(job.createdAt)}
      </span>

      <span className="ml-auto text-xs text-muted-foreground">{elapsed}</span>

      <div className="w-28 text-right">
        {job.status === "done" && (
          <Button variant="outline" size="sm" asChild>
            <Link to={`/videos/${job.id}`}>View</Link>
          </Button>
        )}
        {job.status === "failed" && (
          <span
            className="block max-w-[120px] truncate text-xs text-destructive"
            title={job.error}
          >
            {job.error ?? "Unknown error"}
          </span>
        )}
        {!terminal && (
          <Button variant="outline" size="sm" asChild>
            <Link to={`/jobs/${job.id}`}>Status</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="h-5 w-28 animate-pulse rounded-full bg-muted" />
      <div className="h-4 w-20 animate-pulse rounded bg-muted" />
      <div className="hidden h-4 w-36 animate-pulse rounded bg-muted sm:block" />
      <div className="ml-auto h-4 w-12 animate-pulse rounded bg-muted" />
      <div className="h-8 w-28 animate-pulse rounded bg-muted" />
    </div>
  );
}

export function DashboardPage() {
  const { data: session } = useSession();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.jobs
      .list()
      .then(({ jobs }) => {
        const sorted = [...jobs].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setJobs(sorted);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load jobs"),
      )
      .finally(() => setLoading(false));
  }, []);

  const doneCount = jobs.filter((j) => j.status !== "failed").length;

  return (
    <div className="flex flex-col gap-6">
      {/* User info header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          {session?.user && (
            <p className="mt-1 text-muted-foreground">
              {session.user.name ?? session.user.email} &middot;{" "}
              {doneCount}/2 free generations used
            </p>
          )}
        </div>
        <Button asChild>
          <Link to="/">New Generation</Link>
        </Button>
      </div>

      {/* Error */}
      {error && <p className="text-center text-destructive">{error}</p>}

      {/* Job list */}
      <Card>
        <CardHeader>
          <CardTitle>Your Generations</CardTitle>
          <CardDescription>Past and in-progress character replacements.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading && (
            <div>
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          )}

          {!loading && jobs.length === 0 && !error && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <p className="text-lg font-medium text-muted-foreground">
                No generations yet.
              </p>
              <p className="text-sm text-muted-foreground">
                Create your first one!
              </p>
              <Button className="mt-4" asChild>
                <Link to="/">Get Started</Link>
              </Button>
            </div>
          )}

          {!loading && jobs.length > 0 && (
            <div>
              {jobs.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
