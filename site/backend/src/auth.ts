import { betterAuth } from "better-auth";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { Kysely } from "kysely";

function createAuth() {
  const tursoUrl = process.env.TURSO_URL;

  if (!tursoUrl) {
    // Return a minimal auth instance when Turso is not configured.
    // This allows the server to start without a database for dev/testing.
    return betterAuth({
      secret: process.env.BETTER_AUTH_SECRET || "dev-secret-change-me",
      baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001",
      socialProviders: {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID || "",
          clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        },
      },
    });
  }

  const db = new Kysely({
    dialect: new LibsqlDialect({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    }),
  });

  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET || "dev-secret-change-me",
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001",
    database: {
      db,
      type: "sqlite",
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      },
    },
    user: {
      additionalFields: {
        googleId: {
          type: "string",
          required: false,
          fieldName: "google_id",
        },
        generationCount: {
          type: "number",
          required: false,
          defaultValue: 0,
          fieldName: "generation_count",
        },
      },
    },
  });
}

export const auth = createAuth();
