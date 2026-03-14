import { betterAuth } from "better-auth";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { config } from "./config.js";

export const auth = betterAuth({
  baseURL: config.auth.url,
  secret: config.auth.secret,
  database: {
    dialect: new LibsqlDialect({
      url: config.turso.url,
      authToken: config.turso.authToken || undefined,
    }),
    type: "sqlite",
  },
  socialProviders: {
    google: {
      clientId: config.auth.google.clientId,
      clientSecret: config.auth.google.clientSecret,
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  trustedOrigins: [config.cors.origin],
});
