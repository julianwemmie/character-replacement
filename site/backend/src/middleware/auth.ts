import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth.js";

/**
 * Auth middleware — validates the session via Better Auth
 * and attaches user info to the request.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    req.userId = session.user.id;
    req.userEmail = session.user.email;
    req.userName = session.user.name ?? undefined;
    req.userImage = session.user.image ?? undefined;
    next();
  } catch {
    res.status(401).json({ error: "Not authenticated" });
  }
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      userName?: string;
      userImage?: string;
    }
  }
}

// Extend Express Request type to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}
