#!/usr/bin/env tsx
/**
 * Diagnostic Script for Data Saving Issues
 * Run this to check why data isn't saving to Neon
 */

import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { readFileSync } from "fs";
import { join } from "path";
import { db } from "../server/db";
import { dailySnapshots, journalPlanMatrix, journalRealityMatrix, timelineIndex } from "../shared/schema";
import { eq, and } from "drizzle-orm";

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

async function runDiagnostics() {
  console.log("🔍 DailyGlass Data Saving Diagnostics\n");
  console.log("=" + "=".repeat(50) + "\n");

  const userId = 'default-user';
  const year = 2025;

  try {
    // 1. Check database connection
    console.log("1️⃣  Database Connection");
    console.log("   DATABASE_URL:", process.env.DATABASE_URL ? "✅ Set" : "❌ Not set");

    // 2. Check if default user exists
    console.log("\n2️⃣  Checking Default User");
    const userCheck = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, userId)
    });
    console.log(`   User 'default-user': ${userCheck ? "✅ Exists" : "❌ Missing (run: npm run db:setup)"}`);

    if (!userCheck) {
      console.log("\n❌ CRITICAL: Default user doesn't exist!");
      console.log("   Run: npm run db:setup");
      process.exit(1);
    }

    // 3. Check plan snapshots
    console.log("\n3️⃣  Plan Snapshots in Database");
    const planSnapshots = await db.select().from(journalPlanMatrix)
      .where(and(
        eq(journalPlanMatrix.user_id, userId),
        eq(journalPlanMatrix.year, year)
      ))
      .orderBy(journalPlanMatrix.snapshot_timestamp);

    console.log(`   Total snapshots: ${planSnapshots.length}`);
    if (planSnapshots.length > 0) {
      const latest = planSnapshots[planSnapshots.length - 1];
      console.log(`   Latest: ${latest.snapshot_timestamp}`);
      console.log(`   Days with data: ${latest.total_planned_days}`);
    }

    // 4. Check reality snapshots
    console.log("\n4️⃣  Reality Snapshots in Database");
    const realitySnapshots = await db.select().from(journalRealityMatrix)
      .where(and(
        eq(journalRealityMatrix.user_id, userId),
        eq(journalRealityMatrix.year, year)
      ))
      .orderBy(journalRealityMatrix.snapshot_timestamp);

    console.log(`   Total snapshots: ${realitySnapshots.length}`);
    if (realitySnapshots.length > 0) {
      const latest = realitySnapshots[realitySnapshots.length - 1];
      console.log(`   Latest: ${latest.snapshot_timestamp}`);
      console.log(`   Days with data: ${latest.total_reality_days}`);
    }

    // 5. Check daily snapshot
    console.log("\n5️⃣  Daily Snapshot (Latest Data Cache)");
    const dailySnapshot = await db.select().from(dailySnapshots)
      .where(and(
        eq(dailySnapshots.user_id, userId),
        eq(dailySnapshots.year, year)
      ))
      .limit(1);

    if (dailySnapshot.length > 0) {
      const snap = dailySnapshot[0];
      const planDays = Object.keys(snap.latest_plan_contents || {}).length;
      const realityDays = Object.keys(snap.latest_reality_contents || {}).length;
      console.log(`   ✅ Exists`);
      console.log(`   Plan days: ${planDays}`);
      console.log(`   Reality days: ${realityDays}`);
      console.log(`   Last updated: ${snap.updated_at}`);
      console.log(`   Completion rate: ${snap.completion_rate}%`);
    } else {
      console.log(`   ⚠️  No daily snapshot exists yet`);
    }

    // 6. Check timeline
    console.log("\n6️⃣  Timeline Index (Time Machine)");
    const timeline = await db.select().from(timelineIndex)
      .where(and(
        eq(timelineIndex.user_id, userId),
        eq(timelineIndex.year, year)
      ))
      .orderBy(timelineIndex.timestamp);

    console.log(`   Timeline entries: ${timeline.length}`);
    if (timeline.length > 0) {
      console.log(`   First change: ${timeline[0].timestamp}`);
      console.log(`   Last change: ${timeline[timeline.length - 1].timestamp}`);
    }

    // 7. Check localStorage (browser-side - show what should be checked)
    console.log("\n7️⃣  LocalStorage Check (Browser Console)");
    console.log("   Open browser console and run:");
    console.log("   localStorage.getItem('journal-plan-2025')");
    console.log("   localStorage.getItem('journal-reality-2025')");
    console.log("   localStorage.getItem('journal-last-sync-2025')");

    // 8. Summary
    console.log("\n" + "=".repeat(52));
    console.log("📊 SUMMARY");
    console.log("=".repeat(52));
    console.log(`Plan snapshots in DB: ${planSnapshots.length}`);
    console.log(`Reality snapshots in DB: ${realitySnapshots.length}`);
    console.log(`Timeline entries: ${timeline.length}`);
    console.log(`Daily snapshot: ${dailySnapshot.length > 0 ? "EXISTS" : "MISSING"}`);

    if (planSnapshots.length === 0 && realitySnapshots.length === 0) {
      console.log("\n⚠️  WARNING: No data in database!");
      console.log("   Possible causes:");
      console.log("   1. App is offline (check browser console for 'isOnline: false')");
      console.log("   2. Auto-save is failing silently");
      console.log("   3. API endpoints are not receiving requests");
      console.log("\n   Next steps:");
      console.log("   1. Check browser console for errors");
      console.log("   2. Check server logs for POST /api/matrix/plan requests");
      console.log("   3. Verify API health: curl http://localhost:5001/api/health");
    }

    console.log("\n✅ Diagnostics complete!");
    process.exit(0);

  } catch (error) {
    console.error("\n❌ Diagnostic failed:");
    console.error(error);
    process.exit(1);
  }
}

runDiagnostics();
