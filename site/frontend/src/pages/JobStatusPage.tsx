import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Cog,
  Sparkles,
  ExternalLink,
  Play,
} from "lucide-react";
import type { Job, JobStatus } from "@character-replacement/shared";
import { getJob } from "@/lib/api";

const POLL_INTERVAL = 3000;

const STATUS_STEPS: { key: JobStatus; label: string; icon: typeof Clock }[] = [
  { key: "queued", label: "Queued", icon: Clock },
  { key: "preprocessing", label: "Preprocessing", icon: Cog },
  { key: "generating", label: "Generating", icon: Sparkles },
  { key: "done", label: "Complete", icon: CheckCircle2 },
];

function getStepIndex(status: JobStatus): number {
  if (status === "failed") return -1;
  return STATUS_STEPS.findIndex((s) => s.key === status);
}

function StatusStepIndicator({ currentStatus }: { currentStatus: JobStatus }) {
  const currentIndex = getStepIndex(currentStatus);
  const isFailed = currentStatus === "failed";

  return (
    <div className="flex items-center justify-between">
      {STATUS_STEPS.map((step, i) => {
        const Icon = step.icon;
        const isActive = i === currentIndex;
        const isComplete = !isFailed && i < currentIndex;
        const isPending = !isFailed && i > currentIndex;

        return (
          <div key={step.key} className="flex flex-col items-center gap-1.5 flex-1">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : isComplete
                    ? "border-green-500 bg-green-500 text-white"
                    : isFailed && i === 0
                      ? "border-red-500 bg-red-500 text-white"
                      : isPending
                        ? "border-muted-foreground/30 bg-muted text-muted-foreground/50"
                        : "border-muted-foreground/30 bg-muted text-muted-foreground/50"
              }`}
            >
              {isActive && currentStatus !== "done" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isComplete ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <Icon className="h-5 w-5" />
              )}
            </div>
            <span
              className={`text-xs font-medium ${
                isActive
                  ? "text-primary"
                  : isComplete
                    ? "text-green-500"
                    : "text-muted-foreground/50"
              }`}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function JobStatusPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchJob = useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await getJob(jobId);
      if (res.success && res.data) {
        setJob(res.data);
        setError(null);
      } else {
        setError(res.error || "Failed to fetch job");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch job");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  // Initial fetch + polling
  useEffect(() => {
    fetchJob();

    const interval = setInterval(() => {
      // Only poll if job is not in a terminal state
      setJob((prev) => {
        if (prev && (prev.status === "done" || prev.status === "failed")) {
          clearInterval(interval);
          return prev;
        }
        fetchJob();
        return prev;
      });
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchJob]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <XCircle className="h-12 w-12 text-red-500" />
            <p className="text-lg font-medium">Error loading job</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={fetchJob}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!job) return null;

  const isDone = job.status === "done";
  const isFailed = job.status === "failed";
  const isProcessing = !isDone && !isFailed;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isProcessing && <Loader2 className="h-5 w-5 animate-spin" />}
            {isDone && <CheckCircle2 className="h-5 w-5 text-green-500" />}
            {isFailed && <XCircle className="h-5 w-5 text-red-500" />}
            {isDone
              ? "Processing Complete"
              : isFailed
                ? "Processing Failed"
                : "Processing Video"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Job info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Job ID</span>
              <p className="font-mono text-xs mt-0.5">{job.id}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Mode</span>
              <p className="capitalize mt-0.5">{job.mode}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Created</span>
              <p className="mt-0.5">
                {new Date(job.createdAt).toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Status</span>
              <p className="flex items-center gap-1 capitalize mt-0.5">
                {job.status}
              </p>
            </div>
          </div>

          {/* Step indicator */}
          {!isFailed && <StatusStepIndicator currentStatus={job.status} />}

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span>{job.progress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isFailed
                    ? "bg-red-500"
                    : isDone
                      ? "bg-green-500"
                      : "bg-primary"
                }`}
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </div>

          {/* Failed state */}
          {isFailed && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-4">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                Error
              </p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {job.error || "An unknown error occurred during processing."}
              </p>
            </div>
          )}

          {/* Done state - video preview + link */}
          {isDone && job.outputUrl && (
            <div className="space-y-4">
              <div className="aspect-video rounded-lg border overflow-hidden bg-black">
                <video
                  src={job.outputUrl}
                  controls
                  className="w-full h-full"
                  preload="metadata"
                />
              </div>
              <div className="flex gap-3">
                <Link to={`/videos/${job.id}`} className="flex-1">
                  <Button className="w-full gap-2">
                    <Play className="h-4 w-4" />
                    View Video Page
                  </Button>
                </Link>
                <a href={job.outputUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Open Direct
                  </Button>
                </a>
              </div>
            </div>
          )}

          {/* Done but no output URL */}
          {isDone && !job.outputUrl && (
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">
                Processing completed but no output URL was provided.
              </p>
            </div>
          )}

          {/* Processing placeholder */}
          {isProcessing && (
            <div className="aspect-video rounded-lg border bg-muted flex items-center justify-center">
              <div className="text-center space-y-2">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-muted-foreground text-sm">
                  Video preview will appear here when processing is complete.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
