import type { Config } from "drizzle-kit";

// Support both local development and Turso production
const isProduction = process.env.NODE_ENV === 'production' && process.env.TURSO_DATABASE_URL;

export default {
  schema: "./shared/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: isProduction ? "turso" : undefined,
  dbCredentials: isProduction
    ? {
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN!,
      }
    : {
        url: process.env.LOCAL_SQLITE_PATH || "./data/dailyglass.db",
      },
} satisfies Config;
