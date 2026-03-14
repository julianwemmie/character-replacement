import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Job } from "@character-replacement/shared";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";

function formatMode(mode: string): string {
  return mode === "replace" ? "Character Replace" : "Animate";
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function VideoViewerPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    document.title = "Video - Character Replacement";
  }, []);

  useEffect(() => {
    if (!id) return;

    api.jobs
      .get(id)
      .then(({ job }) => setJob(job))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(err instanceof Error ? err.message : "Failed to load video");
        }
      });
  }, [id]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available (e.g. HTTP context)
    }
  }

  async function handleDownload() {
    if (!job?.outputUrl || downloading) return;
    setDownloading(true);

    try {
      const response = await fetch(job.outputUrl);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `character-replacement-${job.id}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download video. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center gap-4 pt-12 text-center">
        <h1 className="text-4xl font-bold text-muted-foreground">Video not found</h1>
        <p className="text-muted-foreground">
          This video doesn't exist or may have been removed.
        </p>
        <Button asChild className="mt-4">
          <Link to="/explore">Browse Videos</Link>
        </Button>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="flex flex-col items-center gap-4 pt-12">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" asChild>
          <Link to="/explore">Browse Videos</Link>
        </Button>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center gap-6 pt-8">
        <Card className="w-full max-w-2xl">
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!job.outputUrl) {
    return (
      <div className="flex flex-col items-center gap-6 pt-8">
        <Card className="w-full max-w-2xl">
          <CardContent className="py-8 text-center text-muted-foreground">
            This video is not available yet.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 pt-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Video</CardTitle>
          <CardDescription>
            {formatMode(job.mode)} &middot; {formatDate(job.createdAt)}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <video
            src={job.outputUrl}
            controls
            className="w-full rounded-md"
          />

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-2">
            <Button onClick={handleDownload} disabled={downloading} className="flex-1">
              {downloading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Downloading...
                </>
              ) : (
                "Download"
              )}
            </Button>
            <Button variant="outline" onClick={copyLink} className="flex-1">
              {copied ? "Copied!" : "Copy Link"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
