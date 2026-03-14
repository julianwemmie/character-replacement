import { Router } from "express";
import type { WebhookPayload } from "@character-replacement/shared";
import { getDb } from "../db.js";
import { AppError } from "../middleware/errorHandler.js";

const router = Router();

/**
 * POST /api/webhooks/modal — Receive completion callback from Modal.
 *
 * Expected payload: { jobId, status, outputUrl?, error? }
 */
router.post("/modal", async (req, res, next) => {
  try {
    const { jobId, status, outputUrl, error } = req.body as WebhookPayload;

    if (!jobId || !status) {
      throw new AppError(400, "jobId and status are required");
    }

    if (status !== "completed" && status !== "failed") {
      throw new AppError(400, "status must be 'completed' or 'failed'");
    }

    const db = getDb();

    const existing = await db.execute({
      sql: "SELECT id FROM jobs WHERE id = ?",
      args: [jobId],
    });

    if (existing.rows.length === 0) {
      throw new AppError(404, "Job not found");
    }

    await db.execute({
      sql: `UPDATE jobs
            SET status = ?, output_url = ?, error = ?, updated_at = datetime('now')
            WHERE id = ?`,
      args: [status, outputUrl || null, error || null, jobId],
    });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
