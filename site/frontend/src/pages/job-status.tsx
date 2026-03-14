import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
import { api, ApiError } from "@/lib/api";

const POLL_INTERVAL = 3000;

const STEPS: { status: JobStatus; label: string }[] = [
  { status: "queued", label: "Queued" },
  { status: "preprocessing", label: "Preprocessing" },
  { status: "generating", label: "Generating" },
  { status: "done", label: "Done" },
];

function isTerminal(status: JobStatus): boolean {
  return status === "done" || status === "failed";
}

function getStepIndex(status: JobStatus): number {
  if (status === "failed") return -1;
  return STEPS.findIndex((s) => s.status === status);
}

function formatElapsed(start: string): string {
  const ms = Date.now() - new Date(start).getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString();
}

function formatMode(mode: string): string {
  return mode === "replace" ? "Character Replace" : "Animate";
}

export function JobStatusPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [elapsed, setElapsed] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    document.title = "Job Status - Character Replacement";
  }, []);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    async function fetchJob() {
      try {
        const { job: data } = await api.jobs.get(id!);
        if (cancelled) return;
        setJob(data);
        setError(null);

        if (isTerminal(data.status)) {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
          if (intervalRef.current) clearInterval(intervalRef.current);
        } else {
          setError(err instanceof Error ? err.message : "Failed to fetch job");
        }
      }
    }

    fetchJob();
    intervalRef.current = setInterval(fetchJob, POLL_INTERVAL);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [id]);

  // Update elapsed timer every second
  useEffect(() => {
    if (!job) return;

    function tick() {
      setElapsed(formatElapsed(job!.createdAt));
    }

    tick();

    if (!isTerminal(job.status)) {
      const timer = setInterval(tick, 1000);
      return () => clearInterval(timer);
    }
  }, [job?.createdAt, job?.status]);

  if (notFound) {
    return (
      <div className="flex flex-col items-center gap-4 pt-12 text-center">
        <h1 className="text-4xl font-bold text-muted-foreground">Job not found</h1>
        <p className="text-muted-foreground">
          This job doesn't exist or may have been removed.
        </p>
        <Button asChild className="mt-4">
          <Link to="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="flex flex-col items-center gap-4 pt-12">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" asChild>
          <Link to="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Job Status</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{id}</p>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading...
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentIndex = getStepIndex(job.status);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Job Status</h1>
        <p className="mt-1 font-mono text-sm text-muted-foreground">{job.id}</p>
      </div>

      {/* Progress Steps */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Progress</CardTitle>
          <Badge variant={job.status}>{job.status}</Badge>
        </CardHeader>
        <CardContent>
          {job.status === "failed" ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-destructive">
                <div className="h-3 w-3 rounded-full bg-destructive" />
                <span className="font-medium">Job Failed</span>
              </div>
              {job.error && (
                <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {job.error}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {STEPS.map((step, i) => {
                const isCompleted = i < currentIndex;
                const isActive = i === currentIndex;
                const isPending = i > currentIndex;

                return (
                  <div key={step.status} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                          isCompleted
                            ? "border-green-500 bg-green-500 text-white"
                            : isActive
                              ? "border-blue-500 bg-blue-500/20 text-blue-400 animate-pulse"
                              : "border-border bg-muted text-muted-foreground"
                        }`}
                      >
                        {isCompleted ? "\u2713" : i + 1}
                      </div>
                      <span
                        className={`text-xs ${
                          isActive
                            ? "font-semibold text-foreground"
                            : isPending
                              ? "text-muted-foreground"
                              : "text-foreground"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div
                        className={`mx-2 h-0.5 flex-1 ${
                          isCompleted ? "bg-green-500" : "bg-border"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Job Details */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Mode</dt>
              <dd className="mt-0.5 font-medium">{formatMode(job.mode)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="mt-0.5 font-medium">{formatDate(job.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {isTerminal(job.status) ? "Duration" : "Elapsed"}
              </dt>
              <dd className="mt-0.5 font-medium">{elapsed}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Output when done */}
      {job.status === "done" && job.outputUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
            <CardDescription>Your video is ready</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <video
              src={job.outputUrl}
              controls
              className="w-full rounded-md"
            />
            <Button asChild>
              <Link to={`/videos/${job.id}`}>View Video Page</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
