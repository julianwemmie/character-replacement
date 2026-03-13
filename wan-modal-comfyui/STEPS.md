# Wan2.2 Animate via ComfyUI on Modal

## Step 0: Research Wan2.2 Animate nodes ✅
- Official tutorial + workflow exists: https://docs.comfy.org/tutorials/video/wan/wan2-2-animate
- ComfyUI has built-in support for Wan2.2 Animate

## Step 1: Set up ComfyUI on Modal with a cheap GPU
- Build the image with ComfyUI + Wan2.2 Animate nodes
- Mount the `wan-model-cache` Volume so it sees the model weights
- Expose via `@modal.web_server(port=8188)` with a short `container_idle_timeout`
- Use something like a T4 or even CPU-only — just enough to load the UI and maybe do a test run at low resolution
- Model weights stay on Modal's Volume — no need to download 56GB locally

## Step 2: Open the UI in your browser, design the workflow
- Connect to the Modal URL
- Build the Wan2.2 Animate node graph, make sure all the model paths resolve
- Export the workflow JSON via "Export (API)" (download it to your local machine)

## Step 3: Build the inference function
- Separate Modal function with the big GPU (H200s)
- Runs ComfyUI headlessly, takes the workflow JSON, executes it, returns results
- CLI entrypoint that uploads inputs, patches file paths into the JSON, calls the function, downloads results
