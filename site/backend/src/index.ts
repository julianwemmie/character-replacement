import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { initDb } from "./db.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { getQueueSize } from "./queue.js";
import jobsRouter from "./routes/jobs.js";
import webhooksRouter from "./routes/webhooks.js";
import exploreRouter from "./routes/explore.js";
import fs from "fs";

const app = express();

// CORS
app.use(
  cors({
    origin: config.cors.origin,
    methods: ["GET", "POST"],
  }),
);

// Body parsing for JSON (webhook routes etc.)
app.use(express.json());

// Ensure upload directory exists
fs.mkdirSync(config.uploadDir, { recursive: true });

// Routes
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", queueSize: getQueueSize() });
});

app.use("/api/jobs", jobsRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/api/explore", exploreRouter);

// Error handling
app.use(errorHandler);

// Start server
async function start(): Promise<void> {
  await initDb();
  console.log("[db] Database initialized");

  app.listen(config.port, () => {
    console.log(`Backend listening on port ${config.port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
