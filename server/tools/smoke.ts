import { db } from "../db";
import { storage } from "../storage";
import {
  users,
  type DayContents,
} from "@shared/schema";
import { eq } from "drizzle-orm";

async function ensureDefaultUser() {
  const userId = "default-user";
  const existing = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (existing.length === 0) {
    await db.insert(users).values({ id: userId, username: "default-user", password: "dev" });
    console.log(`Seeded user '${userId}'.`);
  }
  return userId;
}

function makeDayContents(sampleText: string): DayContents {
  return {
    day_001: `${sampleText} – Jan 1`,
    day_010: `${sampleText} – Jan 10`,
    day_100: `${sampleText} – Apr 10`,
    day_200: `${sampleText} – Jul 19`,
    day_300: `${sampleText} – Oct 27`,
  };
}

async function run() {
  const userId = await ensureDefaultUser();
  const year = new Date().getFullYear();

  const beforePlan = await storage.getAllPlanSnapshots(userId, year);
  const beforeReality = await storage.getAllRealitySnapshots(userId, year);
  const beforeDaily = await storage.getDailySnapshot(userId, year);
  const beforeTimeline = await storage.getTimeline(userId, year);
  console.log("Before:", {
    plan: beforePlan.length,
    reality: beforeReality.length,
    daily: beforeDaily ? 1 : 0,
    timeline: beforeTimeline.length,
  });

  // Insert a plan snapshot
  await storage.createPlanSnapshot({
    userId: userId,
    snapshot_timestamp: new Date(),
    year,
    day_contents: makeDayContents("Plan"),
    metadata: { source: "smoke", mode: "plan" },
  });

  // Insert a reality snapshot
  await storage.createRealitySnapshot({
    user_id: userId,
    snapshot_timestamp: new Date(),
    year,
    day_contents: makeDayContents("Reality"),
    metadata: { source: "smoke", mode: "reality" },
  });

  // Validate full-state behavior: create second plan snapshot with only one change
  const ts2 = new Date();
  await storage.createPlanSnapshot({
    user_id: userId,
    snapshot_timestamp: ts2,
    year,
    day_contents: { day_001: "Plan – Overwrite Jan 1" },
    metadata: { source: "smoke", mode: "plan", test: "full-state-merge" },
  });

  // Fetch the second snapshot and ensure previously set fields persist
  const snap = await storage.getPlanSnapshot(userId, ts2.toISOString());
  console.log("Full-state check -> day_010:", (snap as any)?.day_010);

  const afterPlan = await storage.getAllPlanSnapshots(userId, year);
  const afterReality = await storage.getAllRealitySnapshots(userId, year);
  const afterDaily = await storage.getDailySnapshot(userId, year);
  const afterTimeline = await storage.getTimeline(userId, year);
  console.log("After:", {
    plan: afterPlan.length,
    reality: afterReality.length,
    daily: afterDaily ? 1 : 0,
    timeline: afterTimeline.length,
  });

  const lastPlan = afterPlan[afterPlan.length - 1] as any;
  console.log("lastPlan has day_001:", lastPlan?.day_001);
  console.log("lastPlan.day_contents keys:", lastPlan?.day_contents ? Object.keys(lastPlan.day_contents) : null);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
