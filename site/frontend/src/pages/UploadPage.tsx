import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Upload,
  Film,
  Image as ImageIcon,
  Link as LinkIcon,
  FileUp,
  Loader2,
  X,
  AlertCircle,
} from "lucide-react";
import type { JobMode } from "@character-replacement/shared";
import { MAX_VIDEO_DURATION_SECONDS } from "@character-replacement/shared";
import { createJobWithFiles } from "@/lib/api";

type VideoInputMode = "file" | "url";

export function UploadPage() {
  const navigate = useNavigate();

  // Form state
  const [mode, setMode] = useState<JobMode>("replace");
  const [videoInputMode, setVideoInputMode] = useState<VideoInputMode>("file");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // Validation state
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoDurationError, setVideoDurationError] = useState<string | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Refs
  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Video file selection + duration validation
  const handleVideoFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      setVideoFile(file);
      setVideoDuration(null);
      setVideoDurationError(null);

      if (!file) return;

      // Validate duration client-side using a hidden video element
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        const dur = video.duration;
        setVideoDuration(dur);
        if (dur > MAX_VIDEO_DURATION_SECONDS) {
          setVideoDurationError(
            `Video is ${dur.toFixed(1)}s long. Maximum is ${MAX_VIDEO_DURATION_SECONDS}s.`
          );
        }
        URL.revokeObjectURL(video.src);
      };
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
      };
      video.src = URL.createObjectURL(file);
    },
    []
  );

  // Image file selection + preview
  const handleImageFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      setImageFile(file);

      // Revoke previous preview
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }

      if (file) {
        setImagePreviewUrl(URL.createObjectURL(file));
      } else {
        setImagePreviewUrl(null);
      }
    },
    [imagePreviewUrl]
  );

  const clearVideo = () => {
    setVideoFile(null);
    setVideoDuration(null);
    setVideoDurationError(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const clearImage = () => {
    setImageFile(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  // Determine if the form is submittable
  const hasVideo =
    videoInputMode === "file" ? !!videoFile : videoUrl.trim().length > 0;
  const hasImage = !!imageFile;
  const hasDurationError = !!videoDurationError;
  const canSubmit = hasVideo && hasImage && !hasDurationError && !submitting;

  // Submit handler
  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    setSubmitError(null);
    setUploadProgress(0);

    try {
      // Simulate initial progress for UX
      setUploadProgress(10);

      const result = await createJobWithFiles({
        videoFile: videoInputMode === "file" ? videoFile : null,
        videoUrl: videoInputMode === "url" ? videoUrl.trim() : undefined,
        imageFile: imageFile!,
        mode,
        onProgress: (pct) => setUploadProgress(pct),
      });

      if (result.success && result.data) {
        navigate(`/jobs/${result.data.id}`);
      } else {
        setSubmitError(result.error || "Failed to create job");
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Create New Video
          </CardTitle>
          <CardDescription>
            Upload a source video and a target character image to generate a new
            video.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* ---- Source Video ---- */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <Film className="h-4 w-4" />
                Source Video
              </label>
              {/* Toggle between file and URL */}
              <div className="flex rounded-md border overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setVideoInputMode("file");
                    setVideoUrl("");
                  }}
                  className={`px-3 py-1 flex items-center gap-1 transition-colors ${
                    videoInputMode === "file"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  <FileUp className="h-3 w-3" />
                  File
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVideoInputMode("url");
                    clearVideo();
                  }}
                  className={`px-3 py-1 flex items-center gap-1 transition-colors ${
                    videoInputMode === "url"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  <LinkIcon className="h-3 w-3" />
                  URL
                </button>
              </div>
            </div>

            {videoInputMode === "file" ? (
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={handleVideoFileChange}
                  />
                  {videoFile && (
                    <button
                      type="button"
                      onClick={clearVideo}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
                {videoFile && videoDuration !== null && !videoDurationError && (
                  <p className="text-xs text-green-600">
                    {videoFile.name} ({videoDuration.toFixed(1)}s,{" "}
                    {(videoFile.size / (1024 * 1024)).toFixed(1)} MB)
                  </p>
                )}
                {videoDurationError && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {videoDurationError}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  MP4, MOV, or WebM. Max {MAX_VIDEO_DURATION_SECONDS}s, 100MB.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  type="url"
                  placeholder="https://youtube.com/watch?v=... or direct video link"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  YouTube, TikTok, or any URL supported by yt-dlp. Max{" "}
                  {MAX_VIDEO_DURATION_SECONDS}s.
                </p>
              </div>
            )}
          </div>

          {/* ---- Target Character Image ---- */}
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Target Character Image
            </label>

            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <div className="relative">
                  <Input
                    ref={imageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleImageFileChange}
                  />
                  {imageFile && (
                    <button
                      type="button"
                      onClick={clearImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, or WebP. Clear front-facing photo works best.
                </p>
              </div>

              {/* Image preview */}
              {imagePreviewUrl && (
                <div className="w-20 h-20 rounded-lg border overflow-hidden bg-muted flex-shrink-0">
                  <img
                    src={imagePreviewUrl}
                    alt="Character preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          </div>

          {/* ---- Mode ---- */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Mode</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="replace"
                  checked={mode === "replace"}
                  onChange={() => setMode("replace")}
                  className="accent-primary"
                />
                <span className="text-sm">Replace Character</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="animate"
                  checked={mode === "animate"}
                  onChange={() => setMode("animate")}
                  className="accent-primary"
                />
                <span className="text-sm">Animate Image</span>
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              {mode === "replace"
                ? "Replace a character in the source video with the target character."
                : "Animate the target character image using motions from the source video."}
            </p>
          </div>

          {/* ---- Upload progress ---- */}
          {submitting && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* ---- Error display ---- */}
          {submitError && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-3">
              <p className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {submitError}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button
            disabled={!canSubmit}
            className="w-full gap-2"
            onClick={handleSubmit}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Generate Video
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
