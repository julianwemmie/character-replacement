# Wan-Modal Performance Optimizations

## Context

After enabling Ulysses sequence parallelism (ulysses_size=8) via a patch to Wan2.2's face_blocks.py, denoising speed improved 7x (17.5s/step -> 2.5s/step). Total inference dropped from ~39 min to ~8 min. These are the remaining optimizations.

## Current Timing (with Ulysses=8, 8x H200)

| Phase | Time | Notes |
|-------|------|-------|
| Preprocess | ~4 min | Single H200 (wasteful) |
| FSDP pipeline init | ~60s | 8x H200 sitting idle |
| Model loading (T5+CLIP+VAE+shards) | ~20s | 8x H200 sitting idle |
| Denoising (6 clips x 20 steps) | ~5 min | Actual GPU work |
| Save + audio mux | ~9s | |
| **Total** | **~10 min** | ~5 min is overhead |

---

## Quick Wins (low effort)

### 1. Use cheaper GPU for preprocessing
- **File:** `wan-modal/app.py` line ~98
- **Change:** `gpu=GPU` -> `gpu="A10G"` (or `"T4"`)
- **Impact:** ~70% cost reduction on preprocess step. YOLO, ViTPose, SAM2 don't need H200.
- **Risk:** Low. Test with typical video resolution to confirm A10G has enough VRAM.

### 2. Parallel file uploads
- **File:** `wan-modal/app.py` lines ~481-486
- **Change:** Use `upload_file.spawn()` + `.get()` instead of sequential `.remote()` calls.
- **Impact:** ~1-2s saved per run.

### 3. Reduce default sample_steps to 15
- **File:** `wan-modal/app.py` line ~459
- **Change:** Default `sample_steps` from 0 (which maps to 20) to 15.
- **Impact:** ~75s saved on denoising (~25% faster). Minor quality trade-off.
- **Note:** Can also use 10 for draft/preview renders.

### 4. Remove `--t5_fsdp` flag
- **File:** `wan-modal/app.py` line ~333
- **Change:** Remove `"--t5_fsdp"` from the inference command.
- **Impact:** ~10-20s saved on FSDP init. T5 is only used once for text encoding and fits on a single H200.
- **Risk:** Medium. Needs testing to confirm it doesn't break multi-GPU flow.

### 5. Add `io_volume.reload()` in inference
- **File:** `wan-modal/app.py`, at the start of the `inference` function
- **Change:** Add `io_volume.reload()` before reading preprocessed files.
- **Impact:** Bug prevention. Ensures inference container sees files committed by preprocess container.

---

## Medium Effort

### 6. Convert to `modal.Cls` with `@modal.enter`
- **Impact:** Eliminates ~80s cold start (FSDP init + model load) on warm containers.
- **Catch:** Inference uses `torchrun` via subprocess. Parent and child processes have separate memory, so `@modal.enter` can't pre-load models into the `torchrun` workers.
- **Pragmatic version:** Use `modal.Cls` with `scaledown_window=15*MINUTES` to at least avoid Modal container cold-start overhead (~10-15s). FSDP init still happens per call.
- **Full version:** Refactor `generate.py` to be importable as a Python library instead of launched via `torchrun`. This eliminates the subprocess boundary and allows true warm containers. Significant effort.

### 7. CPU memory snapshots
- **Change:** Add `enable_memory_snapshot=True` to the cls/function decorator. Use two-phase `@modal.enter(snap=True)` / `@modal.enter(snap=False)` pattern.
- **Impact:** ~3x faster cold start (load weights to CPU in snapshot, distribute to GPUs on restore).
- **Note:** GPU snapshots (`enable_gpu_snapshot`) do NOT work with multi-GPU setups per Modal docs. CPU-only snapshots still help.
- **Prerequisite:** Requires converting to `modal.Cls` first.

---

## Architectural (high effort, highest impact)

### 8. Refactor away from `torchrun` subprocess
- **What:** Import Wan2.2's generation pipeline as a Python library. Initialize FSDP process group and load models in `@modal.enter()`. Call generation directly in `@modal.method()`.
- **Impact:** Combined with `modal.Cls` + memory snapshots, warm calls would skip ALL overhead. Inference would be pure denoising time (~5 min) with zero cold start.
- **Effort:** High. Requires understanding and refactoring `generate.py` internals.

### 9. Pre-shard model checkpoints
- **What:** Save already-FSDP-sharded checkpoints to the volume (one set per GPU rank). Skip runtime sharding.
- **Impact:** Could reduce FSDP init from 60s to ~15-20s.
- **Prerequisite:** Requires one-time conversion step and understanding of FSDP checkpoint format.

---

## Other Notes

- **Resolution reduction for drafts:** `960*544` or `640*360` instead of `1280*720` for faster iteration. Denoising scales roughly with pixel count.
- **`scaledown_window`:** Set to 15-20 min on inference to keep containers warm between calls.
- **`TORCHINDUCTOR_COMPILE_THREADS=1`:** Add to image env if using memory snapshots (prevents torch.compile snapshot failures).
- **`HF_XET_HIGH_PERFORMANCE=1`:** Add to image env for faster model downloads.
