import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@shared/schema";

const sqlite = new Database(process.env.LOCAL_SQLITE_PATH || "./data/dailyglass.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });

// Run migrations on startup - skip if tables already exist
try {
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  const tableNames = tables.map((t: any) => t.name);

  if (!tableNames.includes('journal_plan_matrix') || !tableNames.includes('journal_reality_matrix')) {
    migrate(db, { migrationsFolder: "./drizzle" });
    console.log("✅ Database migrations completed successfully");
  } else {
    console.log("✅ Database tables already exist, skipping migrations");
  }
} catch (error) {
  console.warn("⚠️  Database migration warning:", error);
  console.log("📄 Continuing with existing database schema...");
}