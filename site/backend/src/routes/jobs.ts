import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import type { Job, CreateJobResponse, GetJobResponse, ListJobsResponse } from "@character-replacement/shared";
import { getDb } from "../db.js";
import { config } from "../config.js";
import { enqueueJob } from "../queue.js";
import { authMiddleware } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { AppError } from "../middleware/errorHandler.js";

const router = Router();

// All job routes require auth
router.use(authMiddleware);

/**
 * POST /api/jobs — Create a new character replacement job.
 * Accepts multipart form data with `video` and `image` files,
 * or a `videoUrl` field for URL-based video input.
 */
router.post(
  "/",
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const userId = req.userId!;
      const db = getDb();

      // Rate limit check
      const user = await db.execute({
        sql: "SELECT generations_used FROM users WHERE id = ?",
        args: [userId],
      });

      const generationsUsed = (user.rows[0]?.generations_used as number) ?? 0;
      if (generationsUsed >= config.rateLimit.maxFreeGenerations) {
        throw new AppError(429, "Free generation limit reached (max 2)");
      }

      // Extract file references
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const videoFile = files?.video?.[0];
      const imageFile = files?.image?.[0];
      const videoUrl = req.body.videoUrl as string | undefined;

      if (!videoFile && !videoUrl) {
        throw new AppError(400, "A video file or videoUrl is required");
      }
      if (!imageFile) {
        throw new AppError(400, "A reference image file is required");
      }

      const jobId = uuidv4();
      const resolvedVideoUrl = videoUrl || videoFile!.path;
      const referenceImageUrl = imageFile.path;
      const now = new Date().toISOString();

      // Create job and increment generation count atomically
      await db.batch([
        {
          sql: `INSERT INTO jobs (id, user_id, status, video_url, reference_image_url, created_at, updated_at)
                VALUES (?, ?, 'pending', ?, ?, ?, ?)`,
          args: [jobId, userId, resolvedVideoUrl, referenceImageUrl, now, now],
        },
        {
          sql: "UPDATE users SET generations_used = generations_used + 1 WHERE id = ?",
          args: [userId],
        },
      ]);

      // Enqueue for processing
      enqueueJob({
        jobId,
        videoUrl: resolvedVideoUrl,
        referenceImageUrl,
      });

      const job: Job = {
        id: jobId,
        userId,
        status: "pending",
        videoUrl: resolvedVideoUrl,
        referenceImageUrl,
        createdAt: now,
        updatedAt: now,
      };

      const response: CreateJobResponse = { job };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/jobs — List jobs for the authenticated user.
 */
router.get("/", async (req, res, next) => {
  try {
    const userId = req.userId!;
    const db = getDb();

    const result = await db.execute({
      sql: "SELECT * FROM jobs WHERE user_id = ? ORDER BY created_at DESC",
      args: [userId],
    });

    const jobs: Job[] = result.rows.map(rowToJob);
    const response: ListJobsResponse = { jobs };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/jobs/:id — Get a single job by ID.
 */
router.get("/:id", async (req, res, next) => {
  try {
    const db = getDb();

    const result = await db.execute({
      sql: "SELECT * FROM jobs WHERE id = ?",
      args: [req.params.id],
    });

    if (result.rows.length === 0) {
      throw new AppError(404, "Job not found");
    }

    const job = rowToJob(result.rows[0]);
    const response: GetJobResponse = { job };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

function rowToJob(row: Record<string, unknown>): Job {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    status: row.status as Job["status"],
    videoUrl: (row.video_url as string) || undefined,
    referenceImageUrl: (row.reference_image_url as string) || undefined,
    outputUrl: (row.output_url as string) || undefined,
    error: (row.error as string) || undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export default router;
