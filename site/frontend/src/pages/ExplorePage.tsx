import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Compass, Loader2, Film, AlertCircle } from "lucide-react";
import type { Job } from "@character-replacement/shared";
import { getVideos } from "@/lib/api";

const PAGE_SIZE = 12;

function SkeletonCard() {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-video bg-muted animate-pulse" />
      <CardContent className="p-4 space-y-2">
        <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
      </CardContent>
    </Card>
  );
}

function VideoCard({ job }: { job: Job }) {
  return (
    <Link to={`/videos/${job.id}`}>
      <Card className="overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer">
        <div className="aspect-video bg-muted relative">
          {job.outputUrl ? (
            <video
              src={job.outputUrl}
              muted
              preload="metadata"
              className="w-full h-full object-cover"
              onMouseOver={(e) => {
                const vid = e.currentTarget;
                vid.currentTime = 0;
                vid.play().catch(() => {});
              }}
              onMouseOut={(e) => {
                e.currentTarget.pause();
                e.currentTarget.currentTime = 0;
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Film className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          <span className="absolute top-2 right-2 text-[10px] font-medium capitalize px-1.5 py-0.5 rounded bg-black/60 text-white">
            {job.mode}
          </span>
        </div>
        <CardContent className="p-4 space-y-1">
          <p className="text-sm font-medium capitalize">
            {job.mode === "replace" ? "Character Replacement" : "Image Animation"}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(job.createdAt).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function ExplorePage() {
  const [videos, setVideos] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVideos = useCallback(async (currentOffset: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getVideos({ limit: PAGE_SIZE, offset: currentOffset });
      if (res.success && res.data) {
        setVideos(res.data);
        setTotal(res.total ?? 0);
      } else {
        setError(res.error || "Failed to load videos");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load videos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVideos(offset);
  }, [fetchVideos, offset]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Compass className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Explore</h1>
      </div>
      <p className="text-muted-foreground">
        Discover videos created by the community.
      </p>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-4">
          <p className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </p>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && videos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Film className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No videos yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Be the first to create a video!
          </p>
          <Link to="/upload">
            <Button className="mt-4">Create Video</Button>
          </Link>
        </div>
      )}

      {/* Video grid */}
      {!loading && !error && videos.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((video) => (
              <VideoCard key={video.id} job={video} />
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

      {/* Loading indicator for pagination */}
      {loading && videos.length > 0 && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
