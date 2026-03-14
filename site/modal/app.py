"""Site-specific Modal functions for the character replacement service.

Provides:
- yt-dlp video download (with duration validation)
- File serving web endpoint (with range request support)
- Thumbnail generation from video files
"""

import fastapi
import modal

IO_VOLUME_NAME = "wan-io"
IO_PATH = "/root/io"
MAX_VIDEO_DURATION = 15  # seconds

app = modal.App("character-replacement-site")

io_volume = modal.Volume.from_name(IO_VOLUME_NAME, create_if_missing=True)

# Lightweight image for yt-dlp downloads
ytdlp_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg")
    .pip_install("yt-dlp")
)

# Lightweight image for file serving (no extra deps needed beyond fastapi)
serve_image = modal.Image.debian_slim(python_version="3.12").pip_install("fastapi")

# Image for thumbnail generation
thumbnail_image = modal.Image.debian_slim(python_version="3.12").apt_install("ffmpeg")


@app.function(
    image=ytdlp_image,
    volumes={IO_PATH: io_volume},
    timeout=300,
)
def download_video(url: str, save_dir: str) -> dict:
    """Download a video from a URL using yt-dlp and save it to the io volume.

    Args:
        url: Video URL (YouTube, etc.)
        save_dir: Directory path on the io volume to save the video (e.g. /root/io/jobs/abc123)

    Returns:
        dict with keys: path, duration, width, height, file_size, filename
    """
    import json
    import os
    import subprocess

    os.makedirs(save_dir, exist_ok=True)

    # First, extract metadata to check duration before downloading
    probe_cmd = [
        "yt-dlp",
        "--dump-json",
        "--no-download",
        url,
    ]
    print(f"Probing video metadata: {url}")
    result = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        raise ValueError(f"Failed to fetch video metadata: {result.stderr}")

    metadata = json.loads(result.stdout)
    duration = metadata.get("duration")
    if duration is not None and duration > MAX_VIDEO_DURATION:
        raise ValueError(
            f"Video duration ({duration:.1f}s) exceeds maximum "
            f"allowed ({MAX_VIDEO_DURATION}s)."
        )

    # Download the video, converting to mp4
    output_template = os.path.join(save_dir, "input_video.%(ext)s")
    download_cmd = [
        "yt-dlp",
        "-f", "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best",
        "--merge-output-format", "mp4",
        "-o", output_template,
        "--no-playlist",
        url,
    ]
    print(f"Downloading video to {save_dir}")
    result = subprocess.run(download_cmd, capture_output=True, text=True, timeout=240)
    if result.returncode != 0:
        raise RuntimeError(f"yt-dlp download failed: {result.stderr}")

    # Find the downloaded file
    video_file = os.path.join(save_dir, "input_video.mp4")
    if not os.path.exists(video_file):
        # Look for any video file in the directory
        for f in os.listdir(save_dir):
            if f.startswith("input_video."):
                video_file = os.path.join(save_dir, f)
                break
        else:
            raise FileNotFoundError(
                f"Downloaded file not found in {save_dir}: {os.listdir(save_dir)}"
            )

    # Get precise metadata with ffprobe
    ffprobe_cmd = [
        "ffprobe",
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        video_file,
    ]
    probe_result = subprocess.run(ffprobe_cmd, capture_output=True, text=True)
    file_size = os.path.getsize(video_file)

    width, height, exact_duration = 0, 0, 0.0
    if probe_result.returncode == 0:
        probe_data = json.loads(probe_result.stdout)
        for stream in probe_data.get("streams", []):
            if stream.get("codec_type") == "video":
                width = int(stream.get("width", 0))
                height = int(stream.get("height", 0))
                break
        exact_duration = float(
            probe_data.get("format", {}).get("duration", duration or 0)
        )

    # Validate duration again with precise measurement
    if exact_duration > MAX_VIDEO_DURATION:
        os.remove(video_file)
        raise ValueError(
            f"Video duration ({exact_duration:.1f}s) exceeds maximum "
            f"allowed ({MAX_VIDEO_DURATION}s)."
        )

    io_volume.commit()
    filename = os.path.basename(video_file)
    print(
        f"Downloaded: {filename} ({width}x{height}, "
        f"{exact_duration:.1f}s, {file_size / (1024*1024):.1f} MB)"
    )

    return {
        "path": video_file,
        "filename": filename,
        "duration": exact_duration,
        "width": width,
        "height": height,
        "file_size": file_size,
    }


@app.function(
    image=thumbnail_image,
    volumes={IO_PATH: io_volume},
    timeout=120,
)
def generate_thumbnail(
    video_path: str,
    output_path: str,
    timestamp: float = 0.0,
) -> str:
    """Generate a thumbnail from a video file on the volume.

    Args:
        video_path: Path to the video file on the io volume.
        output_path: Path to save the thumbnail (e.g. /root/io/jobs/abc123/thumb.png).
        timestamp: Time in seconds to extract the frame from.

    Returns:
        Path to the saved thumbnail.
    """
    import os
    import subprocess

    io_volume.reload()

    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video not found: {video_path}")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    cmd = [
        "ffmpeg",
        "-y",
        "-ss", str(timestamp),
        "-i", video_path,
        "-frames:v", "1",
        "-q:v", "2",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Thumbnail generation failed: {result.stderr}")

    if not os.path.exists(output_path):
        raise FileNotFoundError(f"Thumbnail was not created at {output_path}")

    io_volume.commit()
    size_kb = os.path.getsize(output_path) / 1024
    print(f"Thumbnail saved: {output_path} ({size_kb:.1f} KB)")
    return output_path


MIME_TYPES = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".mkv": "video/x-matroska",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
}


@app.function(
    image=serve_image,
    volumes={IO_PATH: io_volume},
    timeout=300,
)
@modal.fastapi_endpoint(method="GET")
def serve_file(path: str, range: str | None = fastapi.Header(default=None)):
    """Serve a file from the io volume with range request support.

    Query parameter:
        path: Relative path within the io volume (e.g. jobs/abc123/output.mp4)
    Header:
        Range: Standard HTTP range header for partial content (e.g. bytes=0-1023)
    """
    import os

    from fastapi.responses import Response

    io_volume.reload()

    # Resolve the full path, ensuring it stays within IO_PATH
    full_path = os.path.normpath(os.path.join(IO_PATH, path))
    if not full_path.startswith(IO_PATH):
        return Response(status_code=403, content="Forbidden")

    if not os.path.exists(full_path):
        return Response(status_code=404, content="File not found")

    if not os.path.isfile(full_path):
        return Response(status_code=400, content="Not a file")

    ext = os.path.splitext(full_path)[1].lower()
    content_type = MIME_TYPES.get(ext, "application/octet-stream")
    file_size = os.path.getsize(full_path)

    # Handle range requests for video streaming
    if range:
        # Parse "bytes=start-end"
        range_spec = range.replace("bytes=", "").strip()
        parts = range_spec.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if parts[1] else file_size - 1
        end = min(end, file_size - 1)
        content_length = end - start + 1

        with open(full_path, "rb") as f:
            f.seek(start)
            data = f.read(content_length)

        return Response(
            content=data,
            status_code=206,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(content_length),
                "Content-Type": content_type,
                "Cache-Control": "public, max-age=3600",
            },
            media_type=content_type,
        )

    # Full file response
    with open(full_path, "rb") as f:
        data = f.read()

    return Response(
        content=data,
        status_code=200,
        headers={
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
            "Content-Type": content_type,
            "Cache-Control": "public, max-age=3600",
        },
        media_type=content_type,
    )


@app.function()
def health_check() -> dict:
    """Health check endpoint for the Modal app."""
    return {"status": "ok"}
