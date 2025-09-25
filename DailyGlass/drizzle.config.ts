import type { Config } from "drizzle-kit";

export default {
  schema: "./shared/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.LOCAL_SQLITE_PATH || "./data/dailyglass.db",
  },
} satisfies Config;
