import modal

MODEL_ID = "Wan-AI/Wan2.2-Animate-14B"
VOLUME_NAME = "wan-model-cache"
IO_VOLUME_NAME = "wan-io"
HF_CACHE_PATH = "/root/.cache/huggingface"
IO_PATH = "/root/io"
WAN_REPO_PATH = "/root/Wan2.2"
GPU = "H100"

app = modal.App("wan-character-replacement")

# Persistent volume for HuggingFace model weights
volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)

# Persistent volume for input/output files
io_volume = modal.Volume.from_name(IO_VOLUME_NAME, create_if_missing=True)

# Image with huggingface_hub installed for downloading
download_image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "huggingface_hub[hf_transfer]",
)

# ---------------------------------------------------------------------------
# Wan2.2 runtime image — pre-built flash-attn wheel (no CUDA compilation needed)
# ---------------------------------------------------------------------------
FLASH_ATTN_WHEEL = (
    "https://github.com/Dao-AILab/flash-attention/releases/download/v2.8.3/"
    "flash_attn-2.8.3+cu12torch2.5cxx11abiFALSE-cp311-cp311-linux_x86_64.whl"
)

wan_image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.4.0-devel-ubuntu22.04",
        add_python="3.11",
    )
    .apt_install(
        "git",
        "clang",
        "libgl1-mesa-glx",
        "libglib2.0-0",
        "ffmpeg",
    )
    .env({"TORCH_CUDA_ARCH_LIST": "8.0;8.6;8.9;9.0;9.0a"})
    # Clone Wan2.2 repo, then install deps exactly as the official README says
    .run_commands(
        "git clone --depth 1 https://github.com/Wan-Video/Wan2.2.git /root/Wan2.2",
    )
    # Pin torch 2.5 first (to match flash-attn wheel)
    .pip_install(
        "torch==2.5.1",
        "torchvision==0.20.1",
        "torchaudio==2.5.1",
        extra_index_url="https://download.pytorch.org/whl/cu124",
    )
    # flash_attn — pre-built wheel
    .pip_install(FLASH_ATTN_WHEEL)
    # Install Wan2.2 requirements, pinning torch so pip doesn't upgrade it
    .run_commands(
        "cd /root/Wan2.2 && pip install setuptools wheel"
        " && echo 'torch==2.5.1' > /tmp/constraints.txt"
        " && PIP_CONSTRAINT=/tmp/constraints.txt pip install -r requirements.txt"
        " && PIP_CONSTRAINT=/tmp/constraints.txt pip install -r requirements_animate.txt",
    )
    .pip_install("onnxruntime-gpu")  # override CPU-only onnxruntime with CUDA support
    .pip_install("moviepy", "hydra-core", "omegaconf", "librosa")
)


@app.function(
    image=download_image,
    volumes={HF_CACHE_PATH: volume},
    secrets=[modal.Secret.from_name("huggingface-token")],
    timeout=7200,  # 2 hours — model is ~56GB
)
def download_model():
    import os
    from huggingface_hub import snapshot_download

    # Enable hf_transfer for faster downloads
    os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "1"

    print(f"Downloading {MODEL_ID} to volume...")
    snapshot_download(
        repo_id=MODEL_ID,
        local_dir=None,  # use default HF cache
        token=os.environ.get("HF_TOKEN"),
    )

    # Commit the volume so files persist
    volume.commit()
    print("Download complete and volume committed.")


@app.function(
    image=wan_image,
    gpu=GPU,
    volumes={HF_CACHE_PATH: volume, IO_PATH: io_volume},
    timeout=1800,  # 30 minutes
)
def preprocess(
    video_path: str,
    refer_path: str,
    save_path: str,
    ckpt_path: str | None = None,
):
    """
    Run Wan2.2 preprocessing pipeline for character replacement.

    Args:
        video_path: Path to the driving video (on the io volume or in the repo).
        refer_path: Path to the reference character image.
        save_path: Path to save processed outputs.
        ckpt_path: Path to process_checkpoint/ dir. Auto-detected from HF cache if None.
    """
    import glob
    import os
    import subprocess

    # --- Locate process_checkpoint inside the HF cache ---
    if ckpt_path is None:
        pattern = os.path.join(
            HF_CACHE_PATH,
            "hub",
            "models--Wan-AI--Wan2.2-Animate-14B",
            "snapshots",
            "*",
            "process_checkpoint",
        )
        matches = glob.glob(pattern)
        assert matches, (
            f"process_checkpoint not found at {pattern}. "
            "Run download_model first."
        )
        ckpt_path = matches[0]
        print(f"Auto-detected ckpt_path: {ckpt_path}")

    # Verify checkpoint files exist
    for subpath in [
        "det/yolov10m.onnx",
        "pose2d/vitpose_h_wholebody.onnx",
        "sam2/sam2_hiera_large.pt",
    ]:
        full = os.path.join(ckpt_path, subpath)
        assert os.path.exists(full), f"Missing checkpoint: {full}"
        print(f"  Found: {subpath}")

    # Verify input files
    assert os.path.exists(video_path), f"Video not found: {video_path}"
    assert os.path.exists(refer_path), f"Reference image not found: {refer_path}"
    print(f"Video:  {video_path}")
    print(f"Refer:  {refer_path}")
    print(f"Output: {save_path}")

    os.makedirs(save_path, exist_ok=True)

    # The preprocess_data.py script uses relative imports
    # (from process_pipepline import ...) so we must run it from its own directory
    preprocess_dir = os.path.join(
        WAN_REPO_PATH, "wan", "modules", "animate", "preprocess"
    )

    # Write a wrapper that monkey-patches SAM2's buggy CUDA connected-components
    # kernel with a CPU fallback (OpenCV) before running preprocess_data.py
    wrapper_path = os.path.join(preprocess_dir, "_run_preprocess.py")
    with open(wrapper_path, "w") as f:
        f.write(
            "import sam2.utils.misc as _misc\n"
            "import torch as _torch\n"
            "import cv2 as _cv2\n"
            "import numpy as _np\n"
            "\n"
            "def _get_cc_cpu(mask):\n"
            "    mask_np = mask.to(_torch.uint8).cpu().numpy()\n"
            "    B, C, H, W = mask_np.shape\n"
            "    labels = _torch.zeros(B, C, H, W, dtype=_torch.int32)\n"
            "    counts = _torch.zeros(B, C, H, W, dtype=_torch.int32)\n"
            "    for b in range(B):\n"
            "        for c in range(C):\n"
            "            n, lbl = _cv2.connectedComponents(mask_np[b, c], connectivity=8)\n"
            "            lbl_t = _torch.from_numpy(lbl.astype(_np.int32))\n"
            "            labels[b, c] = lbl_t\n"
            "            for i in range(1, n):\n"
            "                area = int((lbl_t == i).sum())\n"
            "                counts[b, c][lbl_t == i] = area\n"
            "    return labels.to(mask.device), counts.to(mask.device)\n"
            "\n"
            "_misc.get_connected_components = _get_cc_cpu\n"
            "print('Patched SAM2 get_connected_components with CPU fallback')\n"
            "\n"
            "import runpy, sys\n"
            "sys.argv[0] = 'preprocess_data.py'\n"
            "runpy.run_path('preprocess_data.py', run_name='__main__')\n"
        )

    cmd = [
        "python", "_run_preprocess.py",
        "--ckpt_path", ckpt_path,
        "--video_path", video_path,
        "--refer_path", refer_path,
        "--save_path", save_path,
        "--resolution_area", "1280", "720",
        "--iterations", "3",
        "--k", "7",
        "--w_len", "1",
        "--h_len", "1",
        "--replace_flag",
    ]

    print(f"\nRunning preprocessing from {preprocess_dir}")
    print(f"Command: {' '.join(cmd)}\n")

    # Stream output in real-time so we can see errors
    process = subprocess.Popen(
        cmd,
        cwd=preprocess_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    for line in process.stdout:
        print(line, end="")

    returncode = process.wait()

    if returncode != 0:
        raise RuntimeError(
            f"preprocess_data.py failed with exit code {returncode}"
        )

    # List output files
    print("\n--- Output files ---")
    for f in sorted(os.listdir(save_path)):
        fpath = os.path.join(save_path, f)
        size_mb = os.path.getsize(fpath) / (1024 * 1024)
        print(f"  {f}  ({size_mb:.1f} MB)")

    # Commit the io volume so results persist
    io_volume.commit()
    print("\nPreprocessing complete. Results committed to io volume.")


@app.function(
    image=wan_image,
    gpu=GPU,
    volumes={HF_CACHE_PATH: volume, IO_PATH: io_volume},
    timeout=3600,  # 1 hour — inference on 14B model can be slow
)
def inference(
    src_root_path: str,
    save_file: str,
    ckpt_dir: str | None = None,
    refert_num: int = 1,
    offload_model: bool = False,
    extra_args: list[str] | None = None,
):
    """
    Run Wan2.2 inference for character replacement.

    Args:
        src_root_path: Path to preprocessed results directory (contains src_pose.mp4, etc.).
        save_file: Path to save the output video.
        ckpt_dir: Path to model checkpoint dir. Auto-detected from HF cache if None.
        refert_num: Number of reference frames.
        offload_model: Whether to offload model to CPU between steps.
        extra_args: Additional CLI args to pass to generate.py.
    """
    import glob
    import os
    import subprocess

    # --- Locate model checkpoint inside the HF cache ---
    if ckpt_dir is None:
        pattern = os.path.join(
            HF_CACHE_PATH,
            "hub",
            "models--Wan-AI--Wan2.2-Animate-14B",
            "snapshots",
            "*",
        )
        matches = glob.glob(pattern)
        assert matches, (
            f"Model checkpoint not found at {pattern}. "
            "Run download_model first."
        )
        ckpt_dir = matches[0]
        print(f"Auto-detected ckpt_dir: {ckpt_dir}")

    # Verify preprocessed inputs exist
    for name in ["src_pose.mp4", "src_face.mp4", "src_bg.mp4", "src_mask.mp4"]:
        fpath = os.path.join(src_root_path, name)
        assert os.path.exists(fpath), f"Missing preprocessed file: {fpath}"
        print(f"  Found: {name}")

    os.makedirs(os.path.dirname(save_file), exist_ok=True)

    cmd = [
        "python", "generate.py",
        "--task", "animate-14B",
        "--ckpt_dir", ckpt_dir,
        "--src_root_path", src_root_path,
        "--save_file", save_file,
        "--refert_num", str(refert_num),
        "--replace_flag",
        "--use_relighting_lora",
        "--offload_model", str(offload_model),
    ]
    if extra_args:
        cmd.extend(extra_args)

    print(f"\nRunning inference from {WAN_REPO_PATH}")
    print(f"Command: {' '.join(cmd)}\n")

    process = subprocess.Popen(
        cmd,
        cwd=WAN_REPO_PATH,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    for line in process.stdout:
        print(line, end="")

    returncode = process.wait()

    if returncode != 0:
        raise RuntimeError(
            f"generate.py failed with exit code {returncode}"
        )

    if os.path.exists(save_file):
        size_mb = os.path.getsize(save_file) / (1024 * 1024)
        print(f"\nOutput video: {save_file} ({size_mb:.1f} MB)")
    else:
        # generate.py may save with a default name — list output dir
        out_dir = os.path.dirname(save_file)
        print(f"\nExpected output not found at {save_file}")
        print(f"Files in {out_dir}:")
        for f in sorted(os.listdir(out_dir)):
            fpath = os.path.join(out_dir, f)
            size_mb = os.path.getsize(fpath) / (1024 * 1024)
            print(f"  {f}  ({size_mb:.1f} MB)")

    io_volume.commit()
    print("\nInference complete. Results committed to io volume.")


@app.function(
    volumes={IO_PATH: io_volume},
    timeout=600,
)
def upload_file(local_bytes: bytes, remote_path: str):
    """Upload a file to the IO volume."""
    import os

    os.makedirs(os.path.dirname(remote_path), exist_ok=True)
    with open(remote_path, "wb") as f:
        f.write(local_bytes)
    io_volume.commit()
    print(f"Uploaded to {remote_path} ({len(local_bytes) / (1024*1024):.1f} MB)")


@app.function(
    volumes={IO_PATH: io_volume},
    timeout=600,
)
def download_file(remote_path: str) -> bytes:
    """Download a file from the IO volume."""
    with open(remote_path, "rb") as f:
        return f.read()


@app.local_entrypoint()
def main(
    video: str = "",
    image: str = "",
    output: str = "output.mp4",
    step: str = "all",
    job_name: str = "default",
    size: str = "1280*720",
    frame_num: int = 0,
    sample_steps: int = 0,
    refert_num: int = 1,
    offload_model: bool = False,
):
    """
    Wan2.2 character replacement pipeline.

    Args:
        video: Local path to driving video (or "example" to use built-in sample).
        image: Local path to reference character image (or "example").
        output: Local path to save the output video.
        step: Which step to run: "preprocess", "inference", or "all" (default).
        job_name: Name for this job (used for remote file paths).
        size: Video resolution, e.g. "1280*720".
        frame_num: Number of frames to generate (0 = use model default).
        sample_steps: Number of denoising steps (0 = use model default of 20).
        refert_num: Number of reference frames (default 1).
        offload_model: Offload model to CPU between steps to save VRAM.
    """
    import os

    remote_job_dir = f"{IO_PATH}/jobs/{job_name}"
    remote_preprocess_path = f"{remote_job_dir}/preprocess_results"
    remote_output_path = f"{remote_job_dir}/output.mp4"

    use_example = video == "example" or (video == "" and image == "")

    run_preprocess = step in ("all", "preprocess")
    run_inference = step in ("all", "inference")

    # --- Upload inputs ---
    if run_preprocess and not use_example:
        assert os.path.exists(video), f"Video file not found: {video}"
        assert os.path.exists(image), f"Image file not found: {image}"

        print(f"Uploading video: {video}")
        with open(video, "rb") as f:
            upload_file.remote(f.read(), f"{remote_job_dir}/input_video.mp4")

        print(f"Uploading image: {image}")
        with open(image, "rb") as f:
            upload_file.remote(f.read(), f"{remote_job_dir}/input_image.png")

    # --- Preprocess ---
    if run_preprocess:
        if use_example:
            examples_dir = f"{WAN_REPO_PATH}/examples/wan_animate/replace"
            video_path = f"{examples_dir}/video.mp4"
            refer_path = f"{examples_dir}/image.jpeg"
        else:
            video_path = f"{remote_job_dir}/input_video.mp4"
            refer_path = f"{remote_job_dir}/input_image.png"

        print("Starting preprocessing...")
        preprocess.remote(
            video_path=video_path,
            refer_path=refer_path,
            save_path=remote_preprocess_path,
        )

    # --- Inference ---
    if run_inference:
        # Build extra args for generate.py
        extra_args = []
        if size != "1280*720":
            extra_args += ["--size", size]
        if frame_num > 0:
            extra_args += ["--frame_num", str(frame_num)]
        if sample_steps > 0:
            extra_args += ["--sample_steps", str(sample_steps)]

        print("Starting inference...")
        inference.remote(
            src_root_path=remote_preprocess_path,
            save_file=remote_output_path,
            refert_num=refert_num,
            offload_model=offload_model,
            extra_args=extra_args,
        )

        # Download output
        print(f"Downloading output to {output}...")
        data = download_file.remote(remote_output_path)
        with open(output, "wb") as f:
            f.write(data)
        print(f"Saved: {output} ({len(data) / (1024*1024):.1f} MB)")
