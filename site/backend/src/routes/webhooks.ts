import { Router } from "express";
import type {
  ApiResponse,
  WebhookPayload,
} from "@character-replacement/shared";
import { setJobStatus, getJob } from "../store";

export const webhookRoutes = Router();

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

/**
 * POST /api/webhooks/modal
 * Receive completion callback from Modal.
 * Secured via a shared secret passed as a Bearer token or query parameter.
 */
webhookRoutes.post("/modal", async (req, res) => {
  try {
    // Validate webhook secret
    if (WEBHOOK_SECRET) {
      const authHeader = req.headers.authorization;
      const querySecret = req.query.secret as string | undefined;
      const providedSecret =
        authHeader?.startsWith("Bearer ")
          ? authHeader.slice(7)
          : querySecret;

      if (providedSecret !== WEBHOOK_SECRET) {
        console.warn(
          "Webhook authentication failed — invalid or missing secret"
        );
        const response: ApiResponse<never> = {
          success: false,
          error: "Unauthorized",
        };
        res.status(401).json(response);
        return;
      }
    }

    const payload = req.body as WebhookPayload;

    if (!payload.job_id) {
      const response: ApiResponse<never> = {
        success: false,
        error: "Missing job_id in webhook payload",
      };
      res.status(400).json(response);
      return;
    }

    console.log(
      `[webhook] Received callback for job ${payload.job_id}: status=${payload.status}`
    );

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
      console.log(
        `[webhook] Job ${payload.job_id} completed: ${payload.output_url}`
      );
    } else if (payload.status === "failed") {
      await setJobStatus(payload.job_id, "failed", {
        error: payload.error || "Processing failed",
      });
      console.error(
        `[webhook] Job ${payload.job_id} failed: ${payload.error}`
      );
    } else {
      // Handle progress updates if status is an intermediate state
      if (payload.progress !== undefined) {
        await setJobStatus(payload.job_id, payload.status as any, {
          progress: payload.progress,
        });
        console.log(
          `[webhook] Job ${payload.job_id} progress update: ${payload.progress}%`
        );
      }
    }

    const response: ApiResponse<{ received: true }> = {
      success: true,
      data: { received: true },
    };
    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[webhook] Error processing callback: ${message}`);
    const response: ApiResponse<never> = { success: false, error: message };
    res.status(500).json(response);
  }
});
