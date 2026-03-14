import { Router } from "express";
import type { WebhookPayload } from "@character-replacement/shared";
import { getJob, updateJobStatus } from "../db.js";
import { AppError } from "../middleware/errorHandler.js";

const router = Router();

/**
 * POST /api/webhooks/modal -- Receive completion callback from Modal.
 *
 * Expected payload: { jobId, status, outputUrl?, error? }
 */
router.post("/modal", async (req, res, next) => {
  try {
    const { jobId, status, outputUrl, error } = req.body as WebhookPayload;

    if (!jobId || !status) {
      throw new AppError(400, "jobId and status are required");
    }

    if (status !== "done" && status !== "failed") {
      throw new AppError(400, "status must be 'done' or 'failed'");
    }

    const existing = await getJob(jobId);
    if (!existing) {
      throw new AppError(404, "Job not found");
    }

    await updateJobStatus(jobId, status, outputUrl, error);

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
