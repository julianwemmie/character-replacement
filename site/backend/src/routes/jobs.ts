import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import type { CreateJobResponse, GetJobResponse, JobMode, ListJobsResponse } from "@character-replacement/shared";
import { getUser, getJob, getJobsByUser, createJob, incrementGenerationCount } from "../db.js";
import { config } from "../config.js";
import { enqueueJob } from "../queue.js";
import { authMiddleware } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { AppError } from "../middleware/errorHandler.js";

const router = Router();

/**
 * POST /api/jobs -- Create a new character replacement job.
 * Accepts multipart form data with `video` and `image` files,
 * or a `videoUrl` field for URL-based video input.
 */
router.post(
  "/",
  authMiddleware,
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const userId = req.userId!;

      // Rate limit check
      const user = await getUser(userId);
      const generationCount = user?.generationCount ?? 0;
      if (generationCount >= config.rateLimit.maxFreeGenerations) {
        throw new AppError(429, "Free generation limit reached (max 2)");
      }

      // Extract file references
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const videoFile = files?.video?.[0];
      const imageFile = files?.image?.[0];
      const videoUrl = req.body.videoUrl as string | undefined;
      const mode = (req.body.mode as JobMode) || "replace";

      if (!videoFile && !videoUrl) {
        throw new AppError(400, "A video file or videoUrl is required");
      }
      if (!imageFile) {
        throw new AppError(400, "A reference image file is required");
      }

      const isVideoUrl = !!videoUrl;
      const resolvedVideoSource = videoUrl || videoFile!.path;
      const referenceImagePath = imageFile.path;

      const job = await createJob({
        id: uuidv4(),
        userId,
        mode,
        videoUrl: resolvedVideoSource,
        referenceImageUrl: referenceImagePath,
      });

      await incrementGenerationCount(userId);

      // Enqueue for processing
      enqueueJob({
        jobId: job.id,
        mode,
        videoSource: resolvedVideoSource,
        isVideoUrl,
        referenceImagePath,
      });

      const response: CreateJobResponse = { job };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/jobs -- List jobs for the authenticated user.
 */
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const jobs = await getJobsByUser(req.userId!);
    const response: ListJobsResponse = { jobs };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/jobs/:id -- Get a single job by ID (public).
 */
router.get("/:id", async (req, res, next) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) {
      throw new AppError(404, "Job not found");
    }

    const response: GetJobResponse = { job };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
