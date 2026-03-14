import { Router } from "express";
import type { GetMeResponse } from "@character-replacement/shared";
import { getGenerationCount } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

/**
 * GET /api/me -- Return the current authenticated user's info.
 */
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const generationCount = await getGenerationCount(req.userId!);
    const response: GetMeResponse = {
      user: {
        id: req.userId!,
        email: req.userEmail,
        name: req.userName,
        avatarUrl: req.userImage,
        generationCount,
        createdAt: "",
      },
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
