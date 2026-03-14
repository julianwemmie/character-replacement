import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, X, Link as LinkIcon, Film, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSession, signIn } from "@/lib/auth-client";
import { api, ApiError } from "@/lib/api";
import type { JobMode } from "@character-replacement/shared";

const MAX_VIDEO_DURATION = 15;
const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type VideoInputTab = "file" | "url";

export function HomePage() {
  const navigate = useNavigate();
  const { data: session } = useSession();

  // Video state
  const [videoTab, setVideoTab] = useState<VideoInputTab>("file");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Mode & submission
  const [mode, setMode] = useState<JobMode>("replace");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ---- Video handlers ----

  const validateAndSetVideo = useCallback((file: File) => {
    setVideoError(null);

    if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
      setVideoError("Unsupported format. Please use MP4, WebM, or MOV.");
      return;
    }

    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      if (video.duration > MAX_VIDEO_DURATION) {
        URL.revokeObjectURL(url);
        setVideoError(`Video is ${video.duration.toFixed(1)}s long. Maximum is ${MAX_VIDEO_DURATION}s.`);
        return;
      }
      setVideoDuration(video.duration);
      setVideoFile(file);
      setVideoPreviewUrl(url);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      setVideoError("Could not read video file.");
    };
    video.src = url;
  }, []);

  const handleVideoDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) validateAndSetVideo(file);
    },
    [validateAndSetVideo],
  );

  const handleVideoFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSetVideo(file);
    },
    [validateAndSetVideo],
  );

  const clearVideo = useCallback(() => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoFile(null);
    setVideoPreviewUrl(null);
    setVideoDuration(null);
    setVideoError(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
  }, [videoPreviewUrl]);

  // ---- Image handlers ----

  const validateAndSetImage = useCallback((file: File) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      return;
    }
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    const url = URL.createObjectURL(file);
    setImageFile(file);
    setImagePreviewUrl(url);
  }, [imagePreviewUrl]);

  const handleImageDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) validateAndSetImage(file);
    },
    [validateAndSetImage],
  );

  const handleImageFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSetImage(file);
    },
    [validateAndSetImage],
  );

  const clearImage = useCallback(() => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(null);
    setImagePreviewUrl(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }, [imagePreviewUrl]);

  // ---- Submit ----

  const hasVideo = videoTab === "file" ? !!videoFile : videoUrl.trim().length > 0;
  const canSubmit = hasVideo && !!imageFile && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    if (!session?.user) {
      await signIn.social({ provider: "google", callbackURL: "/" });
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const formData = new FormData();
      formData.append("mode", mode);

      if (videoTab === "file" && videoFile) {
        formData.append("video", videoFile);
      } else if (videoTab === "url") {
        formData.append("videoUrl", videoUrl.trim());
      }

      if (imageFile) {
        formData.append("referenceImage", imageFile);
      }

      const { job } = await api.jobs.create(formData);
      navigate(`/jobs/${job.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-8 pt-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Replace Characters in Video</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Upload a video and a reference image to swap characters using AI.
        </p>
      </div>

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>New Generation</CardTitle>
          <CardDescription>Provide a source video and reference character image.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {/* ---- Video Input ---- */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium">Source Video</label>

            {/* Tabs */}
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => setVideoTab("file")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  videoTab === "file"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Film className="h-4 w-4" />
                File Upload
              </button>
              <button
                type="button"
                onClick={() => setVideoTab("url")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  videoTab === "url"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LinkIcon className="h-4 w-4" />
                Paste URL
              </button>
            </div>

            {videoTab === "file" ? (
              videoFile && videoPreviewUrl ? (
                <div className="relative overflow-hidden rounded-lg border border-border">
                  <video
                    src={videoPreviewUrl}
                    controls
                    className="max-h-64 w-full object-contain bg-black"
                  />
                  <div className="flex items-center justify-between border-t border-border px-3 py-2 text-sm">
                    <span className="truncate text-muted-foreground">
                      {videoFile.name} ({formatFileSize(videoFile.size)}
                      {videoDuration !== null && ` / ${videoDuration.toFixed(1)}s`})
                    </span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={clearVideo}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleVideoDrop}
                  onClick={() => videoInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border px-6 py-10 text-center transition-colors hover:border-foreground/30 hover:bg-accent/50"
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Drag and drop a video, or click to select</p>
                  <p className="text-xs text-muted-foreground">
                    MP4, WebM, or MOV &middot; Max {MAX_VIDEO_DURATION} seconds
                  </p>
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    className="hidden"
                    onChange={handleVideoFileChange}
                  />
                </div>
              )
            ) : (
              <div className="flex flex-col gap-2">
                <Input
                  type="url"
                  placeholder="https://youtube.com/watch?v=... or TikTok URL"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Paste a YouTube or TikTok URL. The video will be downloaded server-side.
                </p>
              </div>
            )}

            {videoError && (
              <p className="text-sm text-destructive">{videoError}</p>
            )}
          </div>

          {/* ---- Reference Image ---- */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium">Reference Character Image</label>

            {imageFile && imagePreviewUrl ? (
              <div className="relative overflow-hidden rounded-lg border border-border">
                <img
                  src={imagePreviewUrl}
                  alt="Reference character"
                  className="max-h-64 w-full object-contain bg-black"
                />
                <div className="flex items-center justify-between border-t border-border px-3 py-2 text-sm">
                  <span className="truncate text-muted-foreground">
                    {imageFile.name} ({formatFileSize(imageFile.size)})
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={clearImage}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleImageDrop}
                onClick={() => imageInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border px-6 py-10 text-center transition-colors hover:border-foreground/30 hover:bg-accent/50"
              >
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">Drag and drop an image, or click to select</p>
                <p className="text-xs text-muted-foreground">PNG, JPG, or WebP</p>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleImageFileChange}
                />
              </div>
            )}
          </div>

          {/* ---- Mode Selection ---- */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium">Mode</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode("replace")}
                className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                  mode === "replace"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-foreground/30"
                }`}
              >
                <p className="text-sm font-medium">Replace Character</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Swap a character in the video with the reference image.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setMode("animate")}
                className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                  mode === "animate"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-foreground/30"
                }`}
              >
                <p className="text-sm font-medium">Animate Character</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Animate the reference character using the video's motion.
                </p>
              </button>
            </div>
          </div>

          {/* ---- Submit ---- */}
          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}

          <Button
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="mt-2"
            size="lg"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : !session?.user ? (
              "Sign in to Generate"
            ) : (
              "Generate"
            )}
          </Button>

          {!session?.user && (
            <p className="text-center text-xs text-muted-foreground">
              You need to sign in before submitting a generation.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
