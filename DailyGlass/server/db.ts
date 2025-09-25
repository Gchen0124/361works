import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@shared/schema";

const sqlite = new Database(process.env.LOCAL_SQLITE_PATH || "./data/dailyglass.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });

// Run migrations on startup
try {
  migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✅ Database migrations completed successfully");
} catch (error) {
  console.error("❌ Database migration failed:", error);
}