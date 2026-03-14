import type { Request, Response, NextFunction } from "express";
import multer from "multer";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error("[error]", err.message);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof multer.MulterError) {
    const messages: Record<string, string> = {
      LIMIT_FILE_SIZE: "File is too large. Maximum size is 100 MB.",
      LIMIT_UNEXPECTED_FILE: "Unexpected file field.",
      LIMIT_FILE_COUNT: "Too many files.",
    };
    const message = messages[err.code] || `Upload error: ${err.message}`;
    res.status(400).json({ error: message });
    return;
  }

  res.status(500).json({ error: "Internal server error" });
}
