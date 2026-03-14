import { Router } from "express";
import type {
  ApiResponse,
  WebhookPayload,
} from "@character-replacement/shared";
import { setJobStatus, getJob } from "../store";

export const webhookRoutes = Router();

/**
 * POST /api/webhooks/modal
 * Receive completion callback from Modal.
 */
webhookRoutes.post("/modal", async (req, res) => {
  try {
    const payload = req.body as WebhookPayload;

    if (!payload.job_id) {
      const response: ApiResponse<never> = {
        success: false,
        error: "Missing job_id in webhook payload",
      };
      res.status(400).json(response);
      return;
    }

    const existing = await getJob(payload.job_id);
    if (!existing) {
      const response: ApiResponse<never> = {
        success: false,
        error: `Job ${payload.job_id} not found`,
      };
      res.status(404).json(response);
      return;
    }

    if (payload.status === "done") {
      await setJobStatus(payload.job_id, "done", {
        progress: 100,
        outputUrl: payload.output_url,
      });
      console.log(`Job ${payload.job_id} completed: ${payload.output_url}`);
    } else if (payload.status === "failed") {
      await setJobStatus(payload.job_id, "failed", {
        error: payload.error || "Processing failed",
      });
      console.error(`Job ${payload.job_id} failed: ${payload.error}`);
    }

    const response: ApiResponse<{ received: true }> = {
      success: true,
      data: { received: true },
    };
    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const response: ApiResponse<never> = { success: false, error: message };
    res.status(500).json(response);
  }
});
