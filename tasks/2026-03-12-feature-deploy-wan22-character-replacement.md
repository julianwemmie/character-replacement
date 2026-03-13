---
status: open
type: feature
created: 2026-03-12
---

# Deploy Wan 2.2 Animate for character replacement on Modal

Deploy Wan2.2-Animate-14B on Modal as a two-step CLI workflow (preprocess → inference) for character replacement. Demo/POC scope.

## Decisions

- **Framework**: Official Wan2.2 repo (generate.py + preprocess_data.py)
- **Architecture**: Two separate Modal functions so intermediate results (pose, face, mask videos) can be inspected before running inference
- **Interface**: CLI via `modal run`
- **GPU**: A100-80GB default, configurable to H100

## What to build

1. **Preprocess function** — takes raw video + reference image, runs preprocess_data.py in replacement mode, returns preprocessed videos
2. **Inference function** — takes preprocessed videos, runs generate.py in replacement mode with relighting LoRA, returns final video
3. **Shared Modal Volume** for caching model weights (~56GB)
4. **CLI entrypoint** to chain the two steps

## Research

### Storage

Use a single `modal.Volume` (v2) for all storage needs:

- **Model weights (~56GB)**: Download once from HuggingFace via `snapshot_download`, mount at `/root/.cache/huggingface`. Reads at 1-2 GB/s (~30-60s cold-start load). Persists across container restarts.
- **Intermediate files**: Both preprocess and inference functions mount the same Volume. Writer commits, reader calls `vol.reload()` to see new files.
- **Input/output files**: User uploads and final videos live on the same Volume.

### Model access

Wan2.2-Animate-14B is not gated — Apache 2.0 license, no HuggingFace account required. Anonymous `snapshot_download()` works fine.

### Storage details
- Volume storage is included in Modal pricing (no separate charge)
- v2 Volumes have no file count limits and support concurrent writers
- NetworkFileSystem is deprecated — don't use
- CloudBucketMount (S3/R2) is overkill for a demo

Modal's recommended pattern: mount Volume at HF cache path, download weights during image build with `image.run_function()`, load model once per container with `@modal.enter()`.

## Reference docs

- [Wan2.2 README](https://github.com/Wan-Video/Wan2.2) — installation, inference commands, memory optimization flags
- [Animate preprocessing guide](https://github.com/Wan-Video/Wan2.2/blob/main/wan/modules/animate/preprocess/UserGuider.md) — preprocessing flags, mask tuning, constraints (single-person only)
- [HuggingFace model card](https://huggingface.co/Wan-AI/Wan2.2-Animate-14B) — model weights, checkpoint structure
