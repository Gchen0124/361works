#!/usr/bin/env tsx
/**
 * Automated End-to-End Test Suite for DailyGlass
 * Tests data saving, API endpoints, and database persistence
 */

import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { readFileSync } from "fs";
import { join } from "path";

// Load environment variables
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

neonConfig.webSocketConstructor = ws;

const API_BASE_URL = 'http://localhost:5001';
const USER_ID = 'default-user';
const YEAR = 2025;

let testsPassed = 0;
let testsFailed = 0;

function pass(message: string) {
  console.log(`✅ ${message}`);
  testsPassed++;
}

function fail(message: string, error?: any) {
  console.log(`❌ ${message}`);
  if (error) console.error('   Error:', error.message || error);
  testsFailed++;
}

async function apiRequest(method: string, url: string, body?: any) {
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

async function runTests() {
  console.log("🧪 DailyGlass Automated Test Suite\n");
  console.log("=" + "=".repeat(50) + "\n");

  // Test 1: Health Check
  console.log("Test 1: API Health Check");
  try {
    const health = await apiRequest('GET', `${API_BASE_URL}/api/health`);
    if (health.status === 'ok') {
      pass(`API is healthy (features: ${health.features.join(', ')})`);
    } else {
      fail('API health check returned unexpected status');
    }
  } catch (error) {
    fail('API health check failed', error);
  }

  console.log();

  // Test 2: Database Connection
  console.log("Test 2: Database Connection");
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    await pool.end();
    pass('Database connection successful');
  } catch (error) {
    fail('Database connection failed', error);
  }

  console.log();

  // Test 3: Default User Exists
  console.log("Test 3: Default User Exists");
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();
    const result = await client.query("SELECT * FROM users WHERE id = $1", [USER_ID]);
    client.release();
    await pool.end();

    if (result.rows.length > 0) {
      pass(`Default user exists (username: ${result.rows[0].username})`);
    } else {
      fail('Default user not found - run: npm run db:setup');
    }
  } catch (error) {
    fail('Failed to check for default user', error);
  }

  console.log();

  // Test 4: Save Plan Snapshot
  console.log("Test 4: Save Plan Snapshot");
  try {
    const testData = {
      user_id: USER_ID,
      snapshot_timestamp: new Date().toISOString(),
      year: YEAR,
      day_contents: {
        day_001: 'Test plan for Jan 1 - automated test',
        day_002: 'Test plan for Jan 2 - automated test',
      },
      metadata: {
        test: true,
        timestamp: new Date().toISOString(),
      }
    };

    const result = await apiRequest('POST', `${API_BASE_URL}/api/matrix/plan`, testData);

    if (result.id) {
      pass(`Plan snapshot saved (ID: ${result.id}, ${result.total_planned_days} days)`);
    } else {
      fail('Plan snapshot response missing ID');
    }
  } catch (error) {
    fail('Failed to save plan snapshot', error);
  }

  console.log();

  // Test 5: Save Reality Snapshot
  console.log("Test 5: Save Reality Snapshot");
  try {
    const testData = {
      user_id: USER_ID,
      snapshot_timestamp: new Date().toISOString(),
      year: YEAR,
      day_contents: {
        day_001: 'Test reality for Jan 1 - automated test',
        day_002: 'Test reality for Jan 2 - automated test',
      },
      metadata: {
        test: true,
        timestamp: new Date().toISOString(),
      }
    };

    const result = await apiRequest('POST', `${API_BASE_URL}/api/matrix/reality`, testData);

    if (result.id) {
      pass(`Reality snapshot saved (ID: ${result.id}, ${result.total_reality_days} days)`);
    } else {
      fail('Reality snapshot response missing ID');
    }
  } catch (error) {
    fail('Failed to save reality snapshot', error);
  }

  console.log();

  // Test 6: Get Daily Snapshot
  console.log("Test 6: Get Daily Snapshot");
  try {
    const result = await apiRequest('GET', `${API_BASE_URL}/api/matrix/${USER_ID}/${YEAR}/daily`);

    if (result.latest_plan_contents && result.latest_reality_contents) {
      const planDays = Object.keys(result.latest_plan_contents).length;
      const realityDays = Object.keys(result.latest_reality_contents).length;
      pass(`Daily snapshot retrieved (${planDays} plan days, ${realityDays} reality days, ${result.completion_rate}% complete)`);
    } else {
      fail('Daily snapshot missing plan or reality contents');
    }
  } catch (error) {
    fail('Failed to get daily snapshot', error);
  }

  console.log();

  // Test 7: Get All Plan Snapshots
  console.log("Test 7: Get All Plan Snapshots");
  try {
    const result = await apiRequest('GET', `${API_BASE_URL}/api/matrix/${USER_ID}/${YEAR}/plans`);

    if (Array.isArray(result)) {
      pass(`Retrieved ${result.length} plan snapshot(s)`);
    } else {
      fail('Plan snapshots response is not an array');
    }
  } catch (error) {
    fail('Failed to get plan snapshots', error);
  }

  console.log();

  // Test 8: Get All Reality Snapshots
  console.log("Test 8: Get All Reality Snapshots");
  try {
    const result = await apiRequest('GET', `${API_BASE_URL}/api/matrix/${USER_ID}/${YEAR}/realities`);

    if (Array.isArray(result)) {
      pass(`Retrieved ${result.length} reality snapshot(s)`);
    } else {
      fail('Reality snapshots response is not an array');
    }
  } catch (error) {
    fail('Failed to get reality snapshots', error);
  }

  console.log();

  // Test 9: Get Timeline
  console.log("Test 9: Get Timeline (Time Machine)");
  try {
    const result = await apiRequest('GET', `${API_BASE_URL}/api/timemachine/${USER_ID}/${YEAR}/timeline`);

    if (Array.isArray(result)) {
      pass(`Retrieved ${result.length} timeline entries`);
      if (result.length > 0) {
        console.log(`   Latest change: ${result[result.length - 1].description}`);
      }
    } else {
      fail('Timeline response is not an array');
    }
  } catch (error) {
    fail('Failed to get timeline', error);
  }

  console.log();

  // Test 10: Verify Data Persisted in Database
  console.log("Test 10: Verify Data in Database");
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();

    const planCount = await client.query(
      "SELECT COUNT(*) FROM journal_plan_matrix WHERE user_id = $1 AND year = $2",
      [USER_ID, YEAR]
    );

    const realityCount = await client.query(
      "SELECT COUNT(*) FROM journal_reality_matrix WHERE user_id = $1 AND year = $2",
      [USER_ID, YEAR]
    );

    const dailySnapshot = await client.query(
      "SELECT * FROM daily_snapshots WHERE user_id = $1 AND year = $2",
      [USER_ID, YEAR]
    );

    client.release();
    await pool.end();

    pass(`Database has ${planCount.rows[0].count} plan snapshots`);
    pass(`Database has ${realityCount.rows[0].count} reality snapshots`);

    if (dailySnapshot.rows.length > 0) {
      pass(`Daily snapshot exists (updated: ${dailySnapshot.rows[0].updated_at})`);
    } else {
      fail('Daily snapshot not found in database');
    }
  } catch (error) {
    fail('Failed to verify data in database', error);
  }

  // Summary
  console.log("\n" + "=".repeat(52));
  console.log("📊 TEST RESULTS");
  console.log("=".repeat(52));
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📈 Success Rate: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%`);

  if (testsFailed === 0) {
    console.log("\n🎉 All tests passed! Your app is working correctly.");
    process.exit(0);
  } else {
    console.log("\n⚠️  Some tests failed. Check the errors above.");
    process.exit(1);
  }
}

// Run tests
console.log("⏳ Starting tests in 2 seconds...");
console.log("   Make sure server is running on http://localhost:5001\n");

setTimeout(runTests, 2000);
