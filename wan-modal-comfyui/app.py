import modal
import pathlib

COMFYUI_PATH = "/root/ComfyUI"
MODELS_VOLUME_NAME = "comfyui-models"
MODELS_PATH = "/root/models"
USER_DATA_VOLUME_NAME = "comfyui-user-data"
USER_DATA_PATH = "/root/comfyui-data"
IO_VOLUME_NAME = "comfyui-io"
IO_PATH = "/root/io"

WORKFLOW_API = pathlib.Path(__file__).parent / "workflow_api.json"

app = modal.App("wan-comfyui")

# Persistent volume for model weights
models_volume = modal.Volume.from_name(MODELS_VOLUME_NAME, create_if_missing=True)

# Persistent volume for ComfyUI user data (saved workflows, inputs, outputs)
user_data_volume = modal.Volume.from_name(USER_DATA_VOLUME_NAME, create_if_missing=True)

# Persistent volume for inference input/output files
io_volume = modal.Volume.from_name(IO_VOLUME_NAME, create_if_missing=True)

# ---------------------------------------------------------------------------
# ComfyUI image with custom nodes for Wan2.2 Animate
# ---------------------------------------------------------------------------
comfyui_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "libgl1-mesa-glx", "libglib2.0-0", "ffmpeg")
    # Clone ComfyUI
    .run_commands(
        "git clone --depth 1 https://github.com/comfyanonymous/ComfyUI.git /root/ComfyUI",
    )
    # Install ComfyUI dependencies
    .run_commands("cd /root/ComfyUI && pip install -r requirements.txt")
    # Install custom nodes for Wan2.2 Animate
    .run_commands(
        "cd /root/ComfyUI/custom_nodes"
        " && git clone --depth 1 https://github.com/kijai/ComfyUI-KJNodes.git"
        " && git clone --depth 1 https://github.com/Fannovel16/comfyui_controlnet_aux.git"
        " && git clone --depth 1 https://github.com/kijai/ComfyUI-segment-anything-2.git",
    )
    # Install custom node dependencies
    .run_commands(
        "cd /root/ComfyUI/custom_nodes/ComfyUI-KJNodes && pip install -r requirements.txt",
        "cd /root/ComfyUI/custom_nodes/comfyui_controlnet_aux && pip install -r requirements.txt",
        "cd /root/ComfyUI/custom_nodes/ComfyUI-segment-anything-2 && if [ -f requirements.txt ]; then pip install -r requirements.txt; fi",
    )
)

# ---------------------------------------------------------------------------
# Lightweight image just for downloading models
# ---------------------------------------------------------------------------
download_image = modal.Image.debian_slim(python_version="3.11").uv_pip_install("huggingface_hub[hf_transfer]")

# Model files to download — (hf_repo, hf_filename, local_subdir)
MODEL_FILES = [
    # Diffusion model (fp8 — smaller, works on cheaper GPUs)
    (
        "Kijai/WanVideo_comfy_fp8_scaled",
        "Wan22Animate/Wan2_2-Animate-14B_fp8_e4m3fn_scaled_KJ.safetensors",
        "diffusion_models",
    ),
    # CLIP Vision
    (
        "Comfy-Org/Wan_2.1_ComfyUI_repackaged",
        "split_files/clip_vision/clip_vision_h.safetensors",
        "clip_vision",
    ),
    # VAE
    (
        "Comfy-Org/Wan_2.2_ComfyUI_Repackaged",
        "split_files/vae/wan_2.1_vae.safetensors",
        "vae",
    ),
    # Text encoder
    (
        "Comfy-Org/Wan_2.1_ComfyUI_repackaged",
        "split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors",
        "text_encoders",
    ),
    # LoRA (4-step acceleration)
    (
        "Kijai/WanVideo_comfy",
        "Lightx2v/lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors",
        "loras",
    ),
    # LoRA (relighting)
    (
        "Kijai/WanVideo_comfy",
        "LoRAs/Wan22_relight/WanAnimate_relight_lora_fp16.safetensors",
        "loras",
    ),
]


@app.function(
    image=download_image,
    volumes={MODELS_PATH: models_volume},
    secrets=[modal.Secret.from_name("huggingface-token")],
    timeout=7200,
)
def download_models():
    """Download all required model files to the volume."""
    import os

    from huggingface_hub import hf_hub_download

    os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "1"

    for repo_id, filename, subdir in MODEL_FILES:
        dest_dir = os.path.join(MODELS_PATH, subdir)
        os.makedirs(dest_dir, exist_ok=True)

        # Just the filename without any subdirectory prefix
        local_name = os.path.basename(filename)
        dest_path = os.path.join(dest_dir, local_name)

        if os.path.exists(dest_path):
            size_mb = os.path.getsize(dest_path) / (1024 * 1024)
            print(f"Already exists: {subdir}/{local_name} ({size_mb:.0f} MB)")
            continue

        print(f"Downloading {repo_id}/{filename} -> {subdir}/{local_name}")
        downloaded = hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            local_dir="/tmp/hf_downloads",
        )
        # Move to the volume (shutil.move handles cross-device moves)
        import shutil
        shutil.move(downloaded, dest_path)
        size_mb = os.path.getsize(dest_path) / (1024 * 1024)
        print(f"  Done: {size_mb:.0f} MB")

    models_volume.commit()
    print("\nAll models downloaded and committed to volume.")


@app.function(
    image=comfyui_image,
    gpu="T4",
    volumes={MODELS_PATH: models_volume, USER_DATA_PATH: user_data_volume},
    timeout=3600,
    # Shut down after 5 minutes of no activity to save credits
    scaledown_window=300,
    max_containers=1,
)
@modal.concurrent(max_inputs=100)
@modal.web_server(port=8188, startup_timeout=120)
def ui():
    """Run ComfyUI web server on a cheap GPU for workflow design."""
    import os
    import subprocess

    # Persist user data (workflows, inputs, outputs) across sessions
    for subdir in ["user", "input", "output"]:
        persistent = os.path.join(USER_DATA_PATH, subdir)
        os.makedirs(persistent, exist_ok=True)
        ephemeral = os.path.join(COMFYUI_PATH, subdir)
        if os.path.isdir(ephemeral) and not os.path.islink(ephemeral):
            # Move any default files into the volume, then replace with symlink
            import shutil
            for item in os.listdir(ephemeral):
                src_item = os.path.join(ephemeral, item)
                dst_item = os.path.join(persistent, item)
                if not os.path.exists(dst_item):
                    shutil.move(src_item, dst_item)
            shutil.rmtree(ephemeral)
        if not os.path.exists(ephemeral):
            os.symlink(persistent, ephemeral)
            print(f"Persisted: {subdir}/")

    # Symlink model directories so ComfyUI finds them
    comfy_models = os.path.join(COMFYUI_PATH, "models")
    for subdir in ["diffusion_models", "clip_vision", "vae", "text_encoders", "loras"]:
        src = os.path.join(MODELS_PATH, subdir)
        dst = os.path.join(comfy_models, subdir)
        if os.path.exists(src):
            # Symlink individual files into the existing ComfyUI model dirs
            os.makedirs(dst, exist_ok=True)
            for fname in os.listdir(src):
                link = os.path.join(dst, fname)
                target = os.path.join(src, fname)
                if not os.path.exists(link):
                    os.symlink(target, link)
                    print(f"Linked: {subdir}/{fname}")

    subprocess.Popen(
        [
            "python", "main.py",
            "--listen", "0.0.0.0",
            "--port", "8188",
            "--disable-auto-launch",
        ],
        cwd=COMFYUI_PATH,
    )


def _setup_comfyui_models():
    """Symlink model files from the volume into ComfyUI's models directory."""
    import os

    comfy_models = os.path.join(COMFYUI_PATH, "models")
    for subdir in ["diffusion_models", "clip_vision", "vae", "text_encoders", "loras"]:
        src = os.path.join(MODELS_PATH, subdir)
        dst = os.path.join(comfy_models, subdir)
        if os.path.exists(src):
            os.makedirs(dst, exist_ok=True)
            for fname in os.listdir(src):
                link = os.path.join(dst, fname)
                target = os.path.join(src, fname)
                if not os.path.exists(link):
                    os.symlink(target, link)
                    print(f"Linked: {subdir}/{fname}")


def _start_comfyui_and_wait():
    """Start ComfyUI headlessly and wait for it to be ready."""
    import subprocess
    import time
    import urllib.request

    process = subprocess.Popen(
        [
            "python", "main.py",
            "--listen", "0.0.0.0",
            "--port", "8188",
            "--disable-auto-launch",
        ],
        cwd=COMFYUI_PATH,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    # Wait for ComfyUI to be ready
    for _ in range(120):
        try:
            urllib.request.urlopen("http://127.0.0.1:8188/system_stats")
            print("ComfyUI is ready.")
            return process
        except Exception:
            time.sleep(1)

    raise RuntimeError("ComfyUI failed to start within 120 seconds")


@app.function(
    image=comfyui_image.add_local_file(WORKFLOW_API, "/root/workflow_api.json"),
    gpu="H200",
    volumes={MODELS_PATH: models_volume, IO_PATH: io_volume},
    timeout=3600,
)
def run_workflow(
    video_bytes: bytes,
    image_bytes: bytes,
    prompt: str = "",
) -> bytes:
    """
    Run the Wan2.2 Animate workflow on good hardware.

    Args:
        video_bytes: The driving video file contents.
        image_bytes: The reference character image file contents.
        prompt: Optional positive prompt override.

    Returns:
        The output video file contents as bytes.
    """
    import glob
    import json
    import os
    import time
    import urllib.request

    _setup_comfyui_models()

    # Write input files to ComfyUI's input directory
    input_dir = os.path.join(COMFYUI_PATH, "input")
    os.makedirs(input_dir, exist_ok=True)

    video_path = os.path.join(input_dir, "video_wan2_2_14B_animate_original_video.mp4")
    image_path = os.path.join(input_dir, "video_wan2_2_14B_animate_reference_image.png")
    with open(video_path, "wb") as f:
        f.write(video_bytes)
    with open(image_path, "wb") as f:
        f.write(image_bytes)
    print(f"Wrote input video ({len(video_bytes) / 1024 / 1024:.1f} MB) and image ({len(image_bytes) / 1024 / 1024:.1f} MB)")

    # Load and optionally patch the workflow
    workflow = json.loads(WORKFLOW_API.read_text())
    if prompt:
        # Node "21" is the positive prompt
        workflow["21"]["inputs"]["text"] = prompt

    # Start ComfyUI
    process = _start_comfyui_and_wait()

    # Submit the workflow
    data = json.dumps({"prompt": workflow}).encode("utf-8")
    req = urllib.request.Request(
        "http://127.0.0.1:8188/prompt",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    response = urllib.request.urlopen(req)
    result = json.loads(response.read())
    prompt_id = result["prompt_id"]
    print(f"Queued prompt: {prompt_id}")

    # Poll for completion
    while True:
        time.sleep(5)
        history_req = urllib.request.urlopen(f"http://127.0.0.1:8188/history/{prompt_id}")
        history = json.loads(history_req.read())
        if prompt_id in history:
            if "outputs" in history[prompt_id]:
                print("Workflow complete!")
                break
            if history[prompt_id].get("status", {}).get("status_str") == "error":
                raise RuntimeError(f"Workflow failed: {history[prompt_id]}")
        print("  Still running...")

    # Find the output video
    output_dir = os.path.join(COMFYUI_PATH, "output", "video")
    if not os.path.isdir(output_dir):
        output_dir = os.path.join(COMFYUI_PATH, "output")

    videos = sorted(glob.glob(os.path.join(output_dir, "*.mp4")))
    if not videos:
        # Check all outputs
        all_files = glob.glob(os.path.join(COMFYUI_PATH, "output", "**", "*"), recursive=True)
        print(f"No mp4 found. All output files: {all_files}")
        raise RuntimeError("No output video found")

    output_file = videos[-1]  # Most recent
    print(f"Output: {output_file} ({os.path.getsize(output_file) / 1024 / 1024:.1f} MB)")

    with open(output_file, "rb") as f:
        return f.read()


@app.local_entrypoint()
def main(
    video: str,
    image: str,
    output: str = "output.mp4",
    prompt: str = "",
):
    """
    Run Wan2.2 Animate via ComfyUI.

    Args:
        video: Local path to the driving video.
        image: Local path to the reference character image.
        output: Local path to save the output video.
        prompt: Optional positive prompt (default from workflow).
    """
    import os

    assert os.path.exists(video), f"Video not found: {video}"
    assert os.path.exists(image), f"Image not found: {image}"

    print(f"Uploading video: {video}")
    with open(video, "rb") as f:
        video_bytes = f.read()

    print(f"Uploading image: {image}")
    with open(image, "rb") as f:
        image_bytes = f.read()

    print("Running workflow on A100...")
    output_bytes = run_workflow.remote(video_bytes, image_bytes, prompt)

    with open(output, "wb") as f:
        f.write(output_bytes)
    print(f"Saved: {output} ({len(output_bytes) / 1024 / 1024:.1f} MB)")
