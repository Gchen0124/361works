#!/usr/bin/env tsx
/**
 * Test Neon Database Connection Script
 * Run this to verify your Neon database is connected and migrations are applied
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
  console.log("⚠️  No .env file found, using existing environment variables");
}

// Configure WebSocket
neonConfig.webSocketConstructor = ws;

async function testConnection() {
  console.log("🔍 Testing Neon database connection...\n");

  if (!process.env.DATABASE_URL) {
    console.error("❌ ERROR: DATABASE_URL environment variable is not set!");
    console.error("   Please add DATABASE_URL to your .env file");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Test basic connection
    console.log("1️⃣  Testing database connection...");
    const client = await pool.connect();
    console.log("   ✅ Connected successfully!\n");

    // Check tables exist
    console.log("2️⃣  Checking if tables exist...");
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    if (tablesResult.rows.length === 0) {
      console.log("   ⚠️  No tables found. Run migrations first:");
      console.log("   npm run db:push\n");
    } else {
      console.log(`   ✅ Found ${tablesResult.rows.length} tables:`);
      tablesResult.rows.forEach((row: any) => {
        console.log(`      - ${row.table_name}`);
      });
      console.log();
    }

    // Test query
    console.log("3️⃣  Testing query execution...");
    const testQuery = await client.query("SELECT NOW() as current_time");
    console.log(`   ✅ Query successful! Server time: ${testQuery.rows[0].current_time}\n`);

    client.release();

    console.log("✨ All tests passed! Your Neon database is ready to use.\n");
    process.exit(0);
  } catch (error) {
    console.error("❌ Connection test failed:");
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testConnection();
