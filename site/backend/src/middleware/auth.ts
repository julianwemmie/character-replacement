import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
  userName?: string;
}

/**
 * Auth middleware that requires a valid session.
 * Attaches userId, userEmail, and userName to the request.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    req.userId = session.user.id;
    req.userEmail = session.user.email;
    req.userName = session.user.name;
    next();
  } catch {
    res.status(401).json({ success: false, error: "Unauthorized" });
  }
}

/**
 * Optional auth middleware — attaches user info if a session exists,
 * but does not block unauthenticated requests.
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (session) {
      req.userId = session.user.id;
      req.userEmail = session.user.email;
      req.userName = session.user.name;
    }
  } catch {
    // Ignore auth errors for optional middleware
  }
  next();
}
