import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  History,
  Clock,
  Loader2,
  Film,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Hourglass,
  LogIn,
} from "lucide-react";
import type { Job, JobStatus } from "@character-replacement/shared";
import { getJobs, getUserLimits } from "@/lib/api";
import { authClient } from "@/lib/auth";

const PAGE_SIZE = 12;

type StatusFilter = "all" | JobStatus;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "done", label: "Completed" },
  { value: "generating", label: "In Progress" },
  { value: "queued", label: "Queued" },
  { value: "failed", label: "Failed" },
];

function statusIcon(status: JobStatus) {
  switch (status) {
    case "done":
      return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    case "failed":
      return <XCircle className="h-3 w-3 text-red-500" />;
    case "generating":
    case "preprocessing":
      return <Loader2 className="h-3 w-3 animate-spin text-blue-500" />;
    case "queued":
      return <Hourglass className="h-3 w-3 text-yellow-500" />;
    default:
      return null;
  }
}

function statusColor(status: JobStatus): string {
  switch (status) {
    case "done":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "failed":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "generating":
    case "preprocessing":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "queued":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function JobCard({ job }: { job: Job }) {
  const linkTo =
    job.status === "done" ? `/videos/${job.id}` : `/jobs/${job.id}`;

  return (
    <Link to={linkTo}>
      <Card className="overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer">
        <div className="aspect-video bg-muted relative">
          {job.outputUrl ? (
            <video
              src={job.outputUrl}
              muted
              preload="metadata"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Film className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          {/* Progress overlay for in-progress jobs */}
          {(job.status === "generating" || job.status === "preprocessing") && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="text-center text-white">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-1" />
                <span className="text-xs">{job.progress}%</span>
              </div>
            </div>
          )}
        </div>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] font-medium capitalize px-2 py-0.5 rounded-full flex items-center gap-1 ${statusColor(job.status)}`}
            >
              {statusIcon(job.status)}
              {job.status}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgo(job.createdAt)}
            </span>
          </div>
          <p className="text-sm font-medium capitalize">
            {job.mode === "replace" ? "Character Replacement" : "Image Animation"}
          </p>
          {job.error && (
            <p className="text-xs text-red-500 truncate">{job.error}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export function HistoryPage() {
  const { data: session, isPending: sessionLoading } =
    authClient.useSession();
  const navigate = useNavigate();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limits, setLimits] = useState<{ used: number; max: number } | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!sessionLoading && !session?.user) {
      navigate("/login");
    }
  }, [session, sessionLoading, navigate]);

  const fetchJobs = useCallback(
    async (currentOffset: number, status: StatusFilter) => {
      setLoading(true);
      setError(null);
      try {
        const res = await getJobs({
          limit: PAGE_SIZE,
          offset: currentOffset,
          status: status === "all" ? undefined : status,
        });
        if (res.success && res.data) {
          setJobs(res.data);
          setTotal(res.total ?? 0);
        } else {
          setError(res.error || "Failed to load jobs");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load jobs");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!sessionLoading && session?.user) {
      fetchJobs(offset, statusFilter);
      getUserLimits()
        .then((res) => {
          if (res.success && res.data) setLimits(res.data);
        })
        .catch(() => {});
    }
  }, [fetchJobs, offset, statusFilter, session, sessionLoading]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  // Show loading while session is resolving
  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not authenticated
  if (!session?.user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <LogIn className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium">Sign in required</p>
        <p className="text-sm text-muted-foreground mt-1">
          Please sign in to view your generation history.
        </p>
        <Link to="/login">
          <Button className="mt-4 gap-2">
            <LogIn className="h-4 w-4" />
            Sign In
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-6 w-6" />
          <h1 className="text-2xl font-bold">My Generations</h1>
        </div>
        {/* Generation count */}
        {limits && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{limits.used}</span>
            {" / "}
            {limits.max} free generations used
          </div>
        )}
      </div>
      <p className="text-muted-foreground">
        View your past video generation jobs.
      </p>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={statusFilter === opt.value ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setStatusFilter(opt.value);
              setOffset(0);
            }}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-4">
          <p className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && jobs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Film className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">
            {statusFilter === "all"
              ? "No generations yet"
              : `No ${statusFilter} generations`}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {statusFilter === "all"
              ? "Create your first video to get started!"
              : "Try changing the filter to see other jobs."}
          </p>
          {statusFilter === "all" && (
            <Link to="/upload">
              <Button className="mt-4">Create Video</Button>
            </Link>
          )}
        </div>
      )}

      {/* Job grid */}
      {!loading && !error && jobs.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
