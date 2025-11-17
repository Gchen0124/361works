import type { Config } from "drizzle-kit";

const DATABASE_URL = process.env.DATABASE_URL;
const USE_NEON = !!DATABASE_URL && DATABASE_URL.includes('neon.tech');

export default {
  schema: "./shared/schema.ts",
  out: "./drizzle",
  dialect: USE_NEON ? "postgresql" : "sqlite",
  dbCredentials: USE_NEON
    ? {
        url: DATABASE_URL!,
      }
    : {
        url: process.env.LOCAL_SQLITE_PATH || "./data/dailyglass.db",
      },
} satisfies Config;
