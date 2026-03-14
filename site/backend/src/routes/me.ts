import { Router } from "express";
import type { GetMeResponse } from "@character-replacement/shared";
import { getUser } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";

const router = Router();

/**
 * GET /api/me -- Return the current authenticated user's info.
 */
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const user = await getUser(req.userId!);
    if (!user) {
      throw new AppError(404, "User not found");
    }
    const response: GetMeResponse = { user };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
