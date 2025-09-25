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

  console.log("Before:");
  const before = await db.run(
    db.session.raw(
      "SELECT 'plan' AS t, COUNT(*) AS c FROM journal_plan_matrix UNION ALL SELECT 'reality', COUNT(*) FROM journal_reality_matrix UNION ALL SELECT 'daily', COUNT(*) FROM daily_snapshots UNION ALL SELECT 'timeline', COUNT(*) FROM timeline_index;",
    ),
  );
  console.table(before.rows);

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

  console.log("After:");
  const after = await db.run(
    db.session.raw(
      "SELECT 'plan' AS t, COUNT(*) AS c FROM journal_plan_matrix UNION ALL SELECT 'reality', COUNT(*) FROM journal_reality_matrix UNION ALL SELECT 'daily', COUNT(*) FROM daily_snapshots UNION ALL SELECT 'timeline', COUNT(*) FROM timeline_index;",
    ),
  );
  console.table(after.rows);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

