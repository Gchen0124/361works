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
    user_id: userId,
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
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
