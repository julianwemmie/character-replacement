import { Router } from "express";
import type { ApiResponse, Job } from "@character-replacement/shared";
import { getJob } from "../store";

export const videoRoutes = Router();

/**
 * GET /api/videos/:id
 * Public endpoint — returns video info without authentication.
 * Used by the shareable video page.
 */
videoRoutes.get("/:id", async (req, res) => {
  try {
    const job = await getJob(req.params.id);

    if (!job) {
      const response: ApiResponse<never> = {
        success: false,
        error: "Video not found",
      };
      res.status(404).json(response);
      return;
    }

    // Return the job data (public view)
    const response: ApiResponse<Job> = { success: true, data: job };
    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const response: ApiResponse<never> = { success: false, error: message };
    res.status(500).json(response);
  }
});
