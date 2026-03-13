# Deployment Steps

## Step 1 — Modal hello world
Get a minimal Modal app running. Confirms account, CLI, and auth are working.
**Test**: `modal run app.py` prints output successfully.
- [x] Done

## Step 2 — Volume + model download
Create the Volume and download Wan2.2-Animate-14B weights via `snapshot_download()`.
**Test**: `modal volume ls` shows model files. Second run skips download.
- [x] Done

## Step 3 — Container image with dependencies
Build Modal image with all Wan2.2 deps (torch, flash-attn, onnxruntime, SAM-2, etc.). No inference yet.
**Test**: A function that imports torch/wan and prints `torch.cuda.is_available() == True` on a GPU container.
- [x] Done

## Step 4 — Preprocessing
Wire up preprocess_data.py as a Modal function. Run replacement mode on sample inputs.
**Test**: Volume contains `src_pose.mp4`, `src_face.mp4`, `src_bg.mp4`, `src_mask.mp4`. Download and visually inspect.
- [x] Done

## Step 5 — Inference
Wire up generate.py as a Modal function. Run replacement mode with relighting LoRA on A100-80GB.
**Test**: Final output video is produced. Download and watch — reference character appears in the source scene.
- [X] Done

## Step 6 — CLI entrypoint
Chain preprocess → inference in a single `run.py` command. Upload inputs, download output.
**Test**: End-to-end run from local machine with a single command.
- [X] Done
