import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Share2,
  Download,
  CheckCircle2,
  Loader2,
  XCircle,
  Copy,
  Check,
} from "lucide-react";
import type { Job } from "@character-replacement/shared";
import { getVideo } from "@/lib/api";

export function VideoPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchVideo = useCallback(async () => {
    if (!videoId) return;
    try {
      const res = await getVideo(videoId);
      if (res.success && res.data) {
        setJob(res.data);
        setError(null);
      } else {
        setError(res.error || "Video not found");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load video");
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    fetchVideo();
  }, [fetchVideo]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement("input");
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  const handleDownload = useCallback(() => {
    if (!job?.outputUrl) return;
    const a = document.createElement("a");
    a.href = job.outputUrl;
    a.download = `character-replacement-${job.id}.mp4`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [job]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <XCircle className="h-12 w-12 text-red-500" />
            <p className="text-lg font-medium">Video not found</p>
            <p className="text-sm text-muted-foreground">
              {error || "This video does not exist or has been removed."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (job.status !== "done" || !job.outputUrl) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
            <p className="text-lg font-medium">Video is still processing</p>
            <p className="text-sm text-muted-foreground">
              This video is not ready yet. Please check back later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Video player */}
      <div className="aspect-video rounded-lg border overflow-hidden bg-black">
        <video
          src={job.outputUrl}
          controls
          autoPlay
          className="w-full h-full"
          preload="metadata"
        />
      </div>

      {/* Info + actions */}
      <Card>
        <CardContent className="flex items-center justify-between pt-6">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Generated Video
            </h2>
            <div className="flex gap-4 mt-1">
              <p className="text-sm text-muted-foreground capitalize">
                Mode: {job.mode}
              </p>
              <p className="text-sm text-muted-foreground">
                Created: {new Date(job.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleCopyLink}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Link
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: "Character Replacement Video",
                    url: window.location.href,
                  });
                } else {
                  handleCopyLink();
                }
              }}
            >
              <Share2 className="h-4 w-4" />
              Share
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
