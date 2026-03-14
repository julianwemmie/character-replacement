import { createAuthClient } from "better-auth/react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const authClient: ReturnType<typeof createAuthClient> = createAuthClient({
  /** In dev, Vite proxies /api to the backend. In production, same origin. */
  baseURL: "http://localhost:3001",
});

/**
 * Sign in with Google OAuth via Better Auth.
 */
export function signInWithGoogle() {
  return authClient.signIn.social({
    provider: "google",
    callbackURL: "/",
  });
}

/**
 * Sign out the current user.
 */
export function signOut() {
  return authClient.signOut({
    fetchOptions: {
      onSuccess: () => {
        window.location.href = "/login";
      },
    },
  });
}
