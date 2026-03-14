import type { Request, Response, NextFunction } from "express";
import { getDb } from "../db.js";

/**
 * Auth middleware placeholder.
 *
 * Currently reads user ID from the x-user-id header.
 * Will be replaced with real authentication in Step 5.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.headers["x-user-id"] as string | undefined;

  if (!userId) {
    res.status(401).json({ error: "Missing x-user-id header" });
    return;
  }

  // Ensure user exists in the database (upsert — single query, race-safe)
  const db = getDb();
  await db.execute({
    sql: "INSERT OR IGNORE INTO users (id) VALUES (?)",
    args: [userId],
  });

  req.userId = userId;
  next();
}

// Extend Express Request type to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}
