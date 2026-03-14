import { createClient, type Client } from "@libsql/client";

let tursoClient: Client | null = null;

/**
 * Get the Turso/libSQL client. Returns null if TURSO_URL is not configured.
 */
export function getTursoClient(): Client | null {
  if (tursoClient) return tursoClient;

  const url = process.env.TURSO_URL;
  if (!url) return null;

  tursoClient = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  return tursoClient;
}

/**
 * Check whether Turso is configured.
 */
export function isTursoConfigured(): boolean {
  return !!process.env.TURSO_URL;
}
