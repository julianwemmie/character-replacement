import express from "express";
import cors from "cors";
import path from "path";
import { jobRoutes } from "./routes/jobs";
import { webhookRoutes } from "./routes/webhooks";
import type { ApiResponse } from "@character-replacement/shared";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use("/api/jobs", jobRoutes);
app.use("/api/webhooks", webhookRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Serve frontend static files in production
const frontendDist = path.resolve(__dirname, "../../frontend/dist");
app.use(express.static(frontendDist));

// SPA fallback: serve index.html for any non-API route
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    next();
    return;
  }
  res.sendFile(path.join(frontendDist, "index.html"), (err) => {
    if (err) {
      // Frontend not built yet — that's fine during dev
      next();
    }
  });
});

// 404 handler for unmatched API routes
app.use("/api", (_req, res) => {
  const response: ApiResponse<never> = {
    success: false,
    error: "Not found",
  };
  res.status(404).json(response);
});

// Global error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err.message);
    const response: ApiResponse<never> = {
      success: false,
      error:
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : err.message,
    };
    res.status(500).json(response);
  }
);

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
