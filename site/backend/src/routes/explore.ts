import { Router } from "express";
import type { ListJobsResponse } from "@character-replacement/shared";
import { getPublicVideos } from "../db.js";

const router = Router();

/**
 * GET /api/explore -- Public endpoint returning all completed videos.
 */
router.get("/", async (_req, res, next) => {
  try {
    const jobs = await getPublicVideos();
    const response: ListJobsResponse = { jobs };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
