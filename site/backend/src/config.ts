import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  turso: {
    url: process.env.TURSO_DATABASE_URL || "file:local.db",
    authToken: process.env.TURSO_AUTH_TOKEN || "",
  },
  modal: {
    tokenId: process.env.MODAL_TOKEN_ID || "",
    tokenSecret: process.env.MODAL_TOKEN_SECRET || "",
    appName: "wan-character-replacement",
  },
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  },
  auth: {
    secret: process.env.BETTER_AUTH_SECRET || "",
    url: process.env.BETTER_AUTH_URL || "http://localhost:3001",
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },
  upload: {
    maxVideoSize: 100 * 1024 * 1024, // 100MB
    maxImageSize: 10 * 1024 * 1024, // 10MB
    allowedVideoTypes: ["video/mp4", "video/webm", "video/quicktime"],
    allowedImageTypes: ["image/png", "image/jpeg", "image/webp"],
  },
  rateLimit: {
    maxFreeGenerations: 2,
  },
  uploadDir: "/tmp/character-replacement-uploads",
  webhookSecret: process.env.WEBHOOK_SECRET || "",
};
