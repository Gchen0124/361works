import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "@shared/schema";

// Create client based on environment
const client = process.env.NODE_ENV === 'production' && process.env.TURSO_DATABASE_URL
  ? createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  : createClient({
      url: `file:${process.env.LOCAL_SQLITE_PATH || "./data/dailyglass.db"}`,
    });

export const db = drizzle(client, { schema });

// Initialize database (async for Turso compatibility)
export async function initializeDatabase() {
  try {
    // Check if tables exist
    const result = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );

    const tableNames = result.rows.map((row: any) => row.name);

    if (!tableNames.includes('journal_plan_matrix') || !tableNames.includes('journal_reality_matrix')) {
      console.log("⚠️  Database tables not found. Please run migrations manually.");
      console.log("   For Turso: turso db shell dailyglass < drizzle/0000_*.sql");
      console.log("   For local: npm run db:push");
    } else {
      console.log("✅ Database tables verified");
    }
  } catch (error) {
    console.error("⚠️  Database initialization error:", error);
  }
}
