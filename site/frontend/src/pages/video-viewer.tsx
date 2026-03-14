import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { Job } from "@character-replacement/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api";

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

  useEffect(() => {
    if (!id) return;

    api.jobs
      .get(id)
      .then(({ job }) => setJob(job))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load video"),
      );
  }, [id]);

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function downloadVideo() {
    if (!job?.outputUrl) return;

    const response = await fetch(job.outputUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `character-replacement-${job.id}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 pt-12">
        <p className="text-destructive">{error}</p>
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

          <div className="flex gap-2">
            <Button onClick={downloadVideo} className="flex-1">
              Download
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
