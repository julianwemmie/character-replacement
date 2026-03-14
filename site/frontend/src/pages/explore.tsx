import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play } from "lucide-react";
import type { Job } from "@character-replacement/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function VideoCard({ job }: { job: Job }) {
  const navigate = useNavigate();

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-lg"
      onClick={() => navigate(`/videos/${job.id}`)}
    >
      <CardContent className="p-0">
        <div className="relative aspect-video overflow-hidden rounded-t-lg bg-black">
          {job.thumbnailUrl ? (
            <>
              <img
                src={job.thumbnailUrl}
                alt="Video thumbnail"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <Play className="h-10 w-10 text-white/80" />
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">No preview</p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between p-3">
          <Badge variant="secondary">
            {job.mode === "replace" ? "Replace" : "Animate"}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDate(job.createdAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="aspect-video animate-pulse rounded-t-lg bg-muted" />
        <div className="flex items-center justify-between p-3">
          <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

export function ExplorePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Explore - Character Replacement";
  }, []);

  useEffect(() => {
    api.explore
      .list()
      .then(({ jobs }) => setJobs(jobs))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load videos"),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Explore</h1>
        <p className="mt-1 text-muted-foreground">
          Browse public character replacement videos.
        </p>
      </div>

      {error && (
        <p className="text-center text-destructive">{error}</p>
      )}

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {!loading && !error && jobs.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            No videos yet.
          </p>
          <p className="text-sm text-muted-foreground">
            Be the first to generate one!
          </p>
        </div>
      )}

      {!loading && jobs.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <VideoCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
