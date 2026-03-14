import mimetypes
import uuid

import modal

IO_VOLUME_NAME = "wan-io"
IO_PATH = "/root/io"
MAX_VIDEO_DURATION = 15  # seconds

app = modal.App("character-replacement-site")

io_volume = modal.Volume.from_name(IO_VOLUME_NAME, create_if_missing=True)

web_image = modal.Image.debian_slim(python_version="3.11").pip_install("fastapi[standard]")

ytdlp_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .pip_install("yt-dlp")
)


@app.function(
    image=ytdlp_image,
    volumes={IO_PATH: io_volume},
    timeout=300,
)
def download_video(url: str, dest_path: str) -> dict:
    """Download a video from a URL (YouTube, TikTok, etc.) to the io volume.

    Args:
        url: Video URL to download.
        dest_path: Destination path on the io volume (e.g. "/root/io/jobs/abc/input.mp4").

    Returns:
        Dict with duration, resolution, file_size, and path.
    """
    import json
    import os
    import subprocess

    os.makedirs(os.path.dirname(dest_path), exist_ok=True)

    # Download to a temp file first, then validate
    tmp_path = dest_path + ".tmp"

    dl_cmd = [
        "yt-dlp",
        "--format", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--merge-output-format", "mp4",
        "--output", tmp_path,
        "--no-playlist",
        url,
    ]
    result = subprocess.run(dl_cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"yt-dlp failed: {result.stderr}")

    if not os.path.exists(tmp_path):
        raise RuntimeError("yt-dlp did not produce an output file")

    # Probe video metadata with ffprobe
    probe_cmd = [
        "ffprobe",
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        tmp_path,
    ]
    probe_result = subprocess.run(probe_cmd, capture_output=True, text=True)
    if probe_result.returncode != 0:
        os.remove(tmp_path)
        raise RuntimeError(f"ffprobe failed: {probe_result.stderr}")

    probe_data = json.loads(probe_result.stdout)
    duration = float(probe_data["format"].get("duration", 0))

    # Validate duration
    if duration > MAX_VIDEO_DURATION:
        os.remove(tmp_path)
        raise ValueError(
            f"Video is {duration:.1f}s, exceeds {MAX_VIDEO_DURATION}s limit"
        )

    # Get resolution from first video stream
    width, height = 0, 0
    for stream in probe_data.get("streams", []):
        if stream.get("codec_type") == "video":
            width = int(stream.get("width", 0))
            height = int(stream.get("height", 0))
            break

    file_size = os.path.getsize(tmp_path)

    os.rename(tmp_path, dest_path)
    io_volume.commit()

    return {
        "path": dest_path,
        "duration": duration,
        "width": width,
        "height": height,
        "file_size": file_size,
    }


@app.function(
    image=web_image,
    volumes={IO_PATH: io_volume},
    timeout=60,
)
@modal.fastapi_endpoint(method="GET")
def serve_file(path: str):
    """Serve a file from the io volume.

    Query param `path` is relative to the io volume root.
    Example: GET /serve_file?path=jobs/abc/output.mp4
    """
    import os

    from fastapi.responses import Response

    io_volume.reload()

    full_path = os.path.join(IO_PATH, path)

    if not os.path.abspath(full_path).startswith(IO_PATH):
        return Response(content="Forbidden", status_code=403)

    if not os.path.isfile(full_path):
        return Response(content="Not found", status_code=404)

    content_type, _ = mimetypes.guess_type(full_path)
    if content_type is None:
        content_type = "application/octet-stream"

    file_size = os.path.getsize(full_path)

    # Read the file and return with proper headers
    with open(full_path, "rb") as f:
        data = f.read()

    headers = {
        "Content-Length": str(file_size),
        "Accept-Ranges": "bytes",
    }

    return Response(content=data, media_type=content_type, headers=headers)


@app.function(
    image=web_image,
    volumes={IO_PATH: io_volume},
    timeout=300,
)
@modal.fastapi_endpoint(method="POST")
def upload_file(file: bytes, path: str = "", filename: str = ""):
    """Upload a file directly to the io volume.

    POST with raw bytes as body. Query params:
      - path: destination relative to io root (optional, auto-generated if empty)
      - filename: original filename for extension detection (optional)

    Returns JSON with the saved path and size.
    """
    import os

    if not file:
        return {"error": "No file provided"}

    if path:
        dest_path = os.path.join(IO_PATH, path)
    else:
        ext = os.path.splitext(filename)[1] if filename else ""
        dest_path = os.path.join(IO_PATH, "uploads", f"{uuid.uuid4()}{ext}")

    if not os.path.abspath(dest_path).startswith(IO_PATH):
        return {"error": "Invalid path"}

    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    with open(dest_path, "wb") as f:
        f.write(file)

    io_volume.commit()

    rel_path = os.path.relpath(dest_path, IO_PATH)
    return {
        "path": rel_path,
        "size": len(file),
        "filename": filename,
    }
