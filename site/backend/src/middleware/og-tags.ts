import type { Request, Response, NextFunction } from "express";
import path from "path";
import { readFile } from "fs/promises";
import { getJob } from "../store";

/**
 * Middleware that intercepts requests to /videos/:id and injects
 * OpenGraph meta tags into the SPA's index.html for social sharing.
 *
 * If the request comes from a bot/crawler (detected via User-Agent), or if
 * no Accept header prefers text/html, we serve the index.html with injected
 * meta tags. Normal browser navigations also get the enriched HTML — the SPA
 * still boots and hydrates as usual.
 */
export function ogTagsMiddleware(frontendDist: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only handle GET requests for /videos/:id
    const match = req.path.match(/^\/videos\/([a-zA-Z0-9_-]+)$/);
    if (!match || req.method !== "GET") {
      next();
      return;
    }

    // Skip if the client wants JSON (API call from SPA)
    const accept = req.headers.accept || "";
    if (!accept.includes("text/html")) {
      next();
      return;
    }

    const videoId = match[1];

    try {
      const job = await getJob(videoId);
      const indexPath = path.join(frontendDist, "index.html");
      let html: string;

      try {
        html = await readFile(indexPath, "utf-8");
      } catch {
        // Frontend not built — fall through to default SPA handler
        next();
        return;
      }

      if (!job || job.status !== "done" || !job.outputUrl) {
        // No video ready — serve plain index.html with basic meta tags
        const basicTags = buildBasicMetaTags(videoId);
        html = injectMetaTags(html, basicTags);
        res.setHeader("Content-Type", "text/html");
        res.send(html);
        return;
      }

      const siteUrl = process.env.SITE_URL || `${req.protocol}://${req.get("host")}`;
      const videoPageUrl = `${siteUrl}/videos/${job.id}`;
      const tags = buildVideoMetaTags(job.id, job.outputUrl, videoPageUrl, job.mode);
      html = injectMetaTags(html, tags);

      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (err) {
      console.error("[og-tags] Error generating meta tags:", err);
      next();
    }
  };
}

function buildBasicMetaTags(videoId: string): string {
  return `
    <meta property="og:title" content="Character Replacement Video" />
    <meta property="og:description" content="Watch this AI-generated character replacement video." />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="Character Replacement Video" />
    <meta name="twitter:description" content="Watch this AI-generated character replacement video." />
  `;
}

function buildVideoMetaTags(
  videoId: string,
  videoUrl: string,
  pageUrl: string,
  mode: string
): string {
  const title =
    mode === "animate"
      ? "AI Image Animation"
      : "AI Character Replacement Video";
  const description =
    mode === "animate"
      ? "Watch this AI-animated character video created with Character Replacement."
      : "Watch this AI-generated character replacement video created with Character Replacement.";

  return `
    <!-- OpenGraph -->
    <meta property="og:title" content="${escapeAttr(title)}" />
    <meta property="og:description" content="${escapeAttr(description)}" />
    <meta property="og:type" content="video.other" />
    <meta property="og:url" content="${escapeAttr(pageUrl)}" />
    <meta property="og:video" content="${escapeAttr(videoUrl)}" />
    <meta property="og:video:secure_url" content="${escapeAttr(videoUrl)}" />
    <meta property="og:video:type" content="video/mp4" />
    <meta property="og:video:width" content="1280" />
    <meta property="og:video:height" content="720" />
    <meta property="og:image" content="${escapeAttr(videoUrl)}" />

    <!-- Twitter Player Card -->
    <meta name="twitter:card" content="player" />
    <meta name="twitter:title" content="${escapeAttr(title)}" />
    <meta name="twitter:description" content="${escapeAttr(description)}" />
    <meta name="twitter:player" content="${escapeAttr(pageUrl)}" />
    <meta name="twitter:player:width" content="1280" />
    <meta name="twitter:player:height" content="720" />
    <meta name="twitter:player:stream" content="${escapeAttr(videoUrl)}" />
    <meta name="twitter:player:stream:content_type" content="video/mp4" />
  `;
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function injectMetaTags(html: string, tags: string): string {
  // Inject meta tags right before </head>
  return html.replace("</head>", `${tags}\n  </head>`);
}
