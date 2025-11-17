import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { neon } from "@neondatabase/serverless";
import Database from "better-sqlite3";
import { migrate as migrateNeon } from "drizzle-orm/neon-serverless/migrator";
import { migrate as migrateSqlite } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@shared/schema";

// Determine which database to use based on environment
const DATABASE_URL = process.env.DATABASE_URL;
const USE_NEON = !!DATABASE_URL && DATABASE_URL.includes('neon.tech');

let db: ReturnType<typeof drizzleNeon> | ReturnType<typeof drizzleSqlite>;
let dbInitialized = false;

// Initialize database connection
async function initializeDatabase() {
  if (dbInitialized) return;

  if (USE_NEON) {
    console.log("🚀 Connecting to Neon PostgreSQL database...");
    const sql = neon(DATABASE_URL!);
    db = drizzleNeon(sql, { schema });

    // Run migrations for Neon
    try {
      await migrateNeon(db as any, { migrationsFolder: "./drizzle" });
      console.log("✅ Neon database migrations completed successfully");
    } catch (error) {
      console.warn("⚠️  Neon migration warning:", error);
      console.log("📄 Continuing with existing Neon schema...");
    }
  } else {
    console.log("⚠️  No Neon DATABASE_URL found, falling back to local SQLite");
    console.log("💡 Set DATABASE_URL in .env to use Neon PostgreSQL");

    const sqlite = new Database(process.env.LOCAL_SQLITE_PATH || "./data/dailyglass.db");
    sqlite.pragma("journal_mode = WAL");
    db = drizzleSqlite(sqlite, { schema });

    // Check if migrations needed for SQLite
    try {
      const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      const tableNames = tables.map((t: any) => t.name);

      if (!tableNames.includes('journal_plan_matrix') || !tableNames.includes('journal_reality_matrix')) {
        console.log("⚠️  Running SQLite migrations...");
        migrateSqlite(db as any, { migrationsFolder: "./drizzle" });
        console.log("✅ SQLite migrations completed");
      } else {
        console.log("✅ SQLite database tables exist");
      }
    } catch (error) {
      console.warn("⚠️  SQLite check warning:", error);
    }
  }

  dbInitialized = true;
}

// Initialize database immediately
initializeDatabase().catch(error => {
  console.error("❌ Fatal database initialization error:", error);
  process.exit(1);
});

export { db, initializeDatabase };