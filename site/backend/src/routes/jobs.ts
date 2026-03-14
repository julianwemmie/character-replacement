import { Router } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import type { ApiResponse, Job, JobMode } from "@character-replacement/shared";
import { createJob, getJob, getAllJobs } from "../store";
import { enqueueJob } from "../queue";

const upload = multer({
  dest: "/tmp/uploads/",
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max per file
  },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === "video") {
      const allowed = ["video/mp4", "video/webm", "video/quicktime"];
      cb(null, allowed.includes(file.mimetype));
    } else if (file.fieldname === "image") {
      const allowed = ["image/png", "image/jpeg", "image/webp"];
      cb(null, allowed.includes(file.mimetype));
    } else {
      cb(null, false);
    }
  },
});

const uploadFields = upload.fields([
  { name: "video", maxCount: 1 },
  { name: "image", maxCount: 1 },
]);

export const jobRoutes = Router();

/**
 * POST /api/jobs
 * Accept multipart form with video file (or URL) + image file, validate, return job ID.
 */
jobRoutes.post("/", uploadFields, (req, res) => {
  try {
    const files = req.files as
      | { video?: Express.Multer.File[]; image?: Express.Multer.File[] }
      | undefined;

    const videoFile = files?.video?.[0];
    const imageFile = files?.image?.[0];
    const sourceVideoUrl = req.body?.sourceVideoUrl as string | undefined;
    const targetImageUrl = req.body?.targetImageUrl as string | undefined;
    const mode = (req.body?.mode as JobMode) || "replace";

    // Validate: need either a video file or a video URL
    const videoPath = videoFile?.path ?? sourceVideoUrl;
    if (!videoPath) {
      const response: ApiResponse<never> = {
        success: false,
        error: "A video file or sourceVideoUrl is required",
      };
      res.status(400).json(response);
      return;
    }

    // Validate: need either an image file or an image URL
    const imagePath = imageFile?.path ?? targetImageUrl;
    if (!imagePath) {
      const response: ApiResponse<never> = {
        success: false,
        error: "An image file or targetImageUrl is required",
      };
      res.status(400).json(response);
      return;
    }

    // Validate mode
    if (mode !== "replace" && mode !== "animate") {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Mode must be "replace" or "animate"',
      };
      res.status(400).json(response);
      return;
    }

    const id = nanoid(12);
    const now = new Date().toISOString();

    const job: Job = {
      id,
      status: "queued",
      mode,
      progress: 0,
      createdAt: now,
      updatedAt: now,
    };

    createJob(job);

    // Enqueue for processing
    enqueueJob({
      jobId: id,
      videoPath,
      imagePath,
      mode,
    });

    const response: ApiResponse<Job> = { success: true, data: job };
    res.status(201).json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const response: ApiResponse<never> = { success: false, error: message };
    res.status(500).json(response);
  }
});

/**
 * GET /api/jobs
 * List all jobs (placeholder for auth — returns all jobs for now).
 */
jobRoutes.get("/", (_req, res) => {
  const jobs = getAllJobs();
  const response: ApiResponse<Job[]> = { success: true, data: jobs };
  res.json(response);
});

/**
 * GET /api/jobs/:id
 * Return job status by ID.
 */
jobRoutes.get("/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    const response: ApiResponse<never> = {
      success: false,
      error: `Job ${req.params.id} not found`,
    };
    res.status(404).json(response);
    return;
  }

  const response: ApiResponse<Job> = { success: true, data: job };
  res.json(response);
});
