#!/usr/bin/env tsx
/**
 * Create Default User for Development
 * This creates a 'default-user' in the database for local testing
 */

import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { readFileSync } from "fs";
import { join } from "path";

// Load environment variables from .env file
try {
  const envFile = readFileSync(join(process.cwd(), '.env'), 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
} catch (error) {
  console.log("⚠️  No .env file found");
}

// Configure WebSocket
neonConfig.webSocketConstructor = ws;

async function createDefaultUser() {
  console.log("🔧 Creating default user...\n");

  if (!process.env.DATABASE_URL) {
    console.error("❌ ERROR: DATABASE_URL not set!");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const client = await pool.connect();

    // Check if default user exists
    const checkResult = await client.query(
      "SELECT id FROM users WHERE id = 'default-user'"
    );

    if (checkResult.rows.length > 0) {
      console.log("✅ Default user already exists!");
      client.release();
      await pool.end();
      return;
    }

    // Create default user
    await client.query(
      `INSERT INTO users (id, username, password, created_at)
       VALUES ('default-user', 'default', 'no-password-needed', NOW())`
    );

    console.log("✅ Default user created successfully!");
    console.log("   User ID: default-user");
    console.log("   Username: default\n");

    client.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating default user:");
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

createDefaultUser();
