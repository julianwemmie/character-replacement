import { Router } from "express";
import type { WebhookPayload } from "@character-replacement/shared";
import { getJob, updateJobStatus } from "../db.js";
import { config } from "../config.js";
import { AppError } from "../middleware/errorHandler.js";

const router = Router();

/**
 * POST /api/webhooks/modal -- Receive completion callback from Modal.
 *
 * Expected payload: { jobId, status, outputUrl?, error? }
 * Requires x-webhook-secret header matching WEBHOOK_SECRET env var.
 */
router.post("/modal", async (req, res, next) => {
  try {
    // Validate shared secret
    const secret = config.webhookSecret;
    if (secret) {
      const provided = req.headers["x-webhook-secret"];
      if (provided !== secret) {
        throw new AppError(401, "Invalid webhook secret");
      }
    }

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
