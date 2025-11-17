import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import * as schema from "@shared/schema";
import ws from "ws";
import { readFileSync } from "fs";
import { join } from "path";

// Load environment variables from .env file (for local development)
if (process.env.NODE_ENV !== 'production') {
  try {
    const envFile = readFileSync(join(process.cwd(), '.env'), 'utf-8');
    envFile.split('\n').forEach(line => {
      const match = line.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  } catch (error) {
    // .env file not found, continue with existing env vars (production)
  }
}

// Configure WebSocket for local development (Neon requires WebSockets)
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

// Run migrations on startup
async function runMigrations() {
  try {
    console.log("🔄 Running database migrations...");
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("✅ Database migrations completed successfully");
  } catch (error) {
    console.warn("⚠️  Database migration warning:", error);
    console.log("📄 Continuing with existing database schema...");
  }
}

// Auto-create default user if it doesn't exist (for production)
async function ensureDefaultUser() {
  try {
    const { users } = schema;

    // Check if default user exists
    const existingUser = await db.select().from(users).where(schema.eq(users.id, 'default-user')).limit(1);

    if (existingUser.length === 0) {
      console.log("🔧 Creating default user...");
      await db.insert(users).values({
        id: 'default-user',
        username: 'default',
        password: 'no-password-needed',
      });
      console.log("✅ Default user created successfully");
    } else {
      console.log("✅ Default user already exists");
    }
  } catch (error) {
    console.error("⚠️  Failed to ensure default user exists:", error);
  }
}

// Run startup tasks
async function initializeDatabase() {
  await runMigrations();
  await ensureDefaultUser();
}

initializeDatabase();