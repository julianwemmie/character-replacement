import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { toNodeHandler } from "better-auth/node";
import { config } from "./config.js";
import { initDb, getJob } from "./db.js";
import { auth } from "./auth.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { getQueueSize } from "./queue.js";
import jobsRouter from "./routes/jobs.js";
import meRouter from "./routes/me.js";
import webhooksRouter from "./routes/webhooks.js";
import exploreRouter from "./routes/explore.js";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIST = path.resolve(__dirname, "../../frontend/dist");
const SPA_INDEX = path.join(FRONTEND_DIST, "index.html");

const app = express();

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`[http] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// CORS — must include credentials for auth cookies
app.use(
  cors({
    origin: config.cors.origin,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);

// Better Auth handler — must be mounted BEFORE express.json()
app.all("/api/auth/*splat", toNodeHandler(auth));

// Body parsing for JSON (webhook routes etc.)
app.use(express.json());

// Ensure upload directory exists
fs.mkdirSync(config.uploadDir, { recursive: true });

// Routes
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", queueSize: getQueueSize() });
});

app.use("/api/jobs", jobsRouter);
app.use("/api/me", meRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/api/explore", exploreRouter);

// ---------------------------------------------------------------------------
// OG meta-tag injection for /videos/:id  (social sharing / link previews)
// ---------------------------------------------------------------------------
function buildOgTags(outputUrl: string, pageUrl: string): string {
  return [
    `<meta property="og:type" content="video.other" />`,
    `<meta property="og:title" content="Character Replacement Video" />`,
    `<meta property="og:description" content="Generated with Wan2.2 character replacement" />`,
    `<meta property="og:video" content="${outputUrl}" />`,
    `<meta property="og:video:type" content="video/mp4" />`,
    `<meta property="og:video:width" content="1280" />`,
    `<meta property="og:video:height" content="720" />`,
    `<meta property="og:url" content="${pageUrl}" />`,
    `<meta name="twitter:card" content="player" />`,
    `<meta name="twitter:player" content="${pageUrl}" />`,
  ].join("\n    ");
}

app.get("/videos/:id", async (req, res, next) => {
  try {
    if (!fs.existsSync(SPA_INDEX)) return next();

    const job = await getJob(req.params.id);
    if (!job?.outputUrl) return res.sendFile(SPA_INDEX);

    const pageUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    const html = fs
      .readFileSync(SPA_INDEX, "utf-8")
      .replace("</head>", `    ${buildOgTags(job.outputUrl, pageUrl)}\n  </head>`);
    res.send(html);
  } catch {
    next();
  }
});

// ---------------------------------------------------------------------------
// Serve built frontend (production) with SPA fallback
// ---------------------------------------------------------------------------
if (fs.existsSync(SPA_INDEX)) {
  app.use(express.static(FRONTEND_DIST));

  // SPA catch-all: any non-API route serves index.html
  app.get("*", (_req, res) => {
    res.sendFile(SPA_INDEX);
  });
}

// Error handling
app.use(errorHandler);

// Start server
async function start(): Promise<void> {
  await initDb();
  console.log("[db] Database initialized");

  const server = app.listen(config.port, () => {
    console.log(`Backend listening on port ${config.port}`);
  });

  // Graceful shutdown — stop accepting connections and let the queue drain
  function shutdown(signal: string) {
    console.log(`\n[shutdown] Received ${signal}, shutting down gracefully...`);
    server.close(() => {
      console.log("[shutdown] HTTP server closed");
      // Give the queue a moment to finish current work
      const remaining = getQueueSize();
      if (remaining > 0) {
        console.log(`[shutdown] Waiting for ${remaining} queued job(s) to finish...`);
      }
      // p-queue will finish the current task; we exit after the server closes
      process.exit(0);
    });
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
