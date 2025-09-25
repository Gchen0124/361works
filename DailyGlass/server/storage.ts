import {
  type User,
  type InsertUser,
  type JournalPlanMatrix,
  type JournalRealityMatrix,
  type DailySnapshot,
  type TimelineIndex,
  type InsertJournalPlanMatrix,
  type InsertJournalRealityMatrix,
  type InsertDailySnapshot,
  type TimeMachineSnapshot,
  type TimeMachineComparison,
  type DayContents,
  users,
  journalPlanMatrix,
  journalRealityMatrix,
  dailySnapshots,
  timelineIndex
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

// Enhanced storage interface with matrix operations and Time Machine support
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Matrix journal operations
  createPlanSnapshot(entry: InsertJournalPlanMatrix): Promise<JournalPlanMatrix>;
  createRealitySnapshot(entry: InsertJournalRealityMatrix): Promise<JournalRealityMatrix>;

  // Get specific snapshots
  getPlanSnapshot(userId: string, timestamp: string): Promise<JournalPlanMatrix | undefined>;
  getRealitySnapshot(userId: string, timestamp: string): Promise<JournalRealityMatrix | undefined>;

  // Get all snapshots for a year
  getAllPlanSnapshots(userId: string, year: number): Promise<JournalPlanMatrix[]>;
  getAllRealitySnapshots(userId: string, year: number): Promise<JournalRealityMatrix[]>;

  // Daily snapshots (latest content)
  getDailySnapshot(userId: string, year: number): Promise<DailySnapshot | undefined>;
  updateDailySnapshot(snapshot: InsertDailySnapshot): Promise<DailySnapshot>;

  // Time Machine operations
  getTimeline(userId: string, year: number): Promise<TimelineIndex[]>;
  getTimeMachineSnapshot(userId: string, timestamp: string, year: number): Promise<TimeMachineSnapshot>;
  compareTimeMachineSnapshots(userId: string, timestamp1: string, timestamp2: string, year: number): Promise<TimeMachineComparison>;

  // Bulk export operations
  exportYearData(userId: string, year: number): Promise<{
    planSnapshots: JournalPlanMatrix[];
    realitySnapshots: JournalRealityMatrix[];
    dailySnapshot: DailySnapshot | undefined;
    timeline: TimelineIndex[];
  }>;
}

// Simplified storage interface - no more complex conversions
export class SqliteStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting user:", error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting user by username:", error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const result = await db.insert(users).values(insertUser).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  // Matrix journal operations
  async createPlanSnapshot(entry: InsertJournalPlanMatrix): Promise<JournalPlanMatrix> {
    try {
      // Direct mapping - day_contents already matches database columns!
      const result = await db.insert(journalPlanMatrix).values({
        user_id: entry.user_id,
        snapshot_timestamp: entry.snapshot_timestamp,
        year: entry.year,
        ...entry.day_contents, // Direct spread - no conversion needed!
        total_planned_days: Object.values(entry.day_contents).filter(content => content !== null && content !== '').length,
        metadata: entry.metadata
      }).returning();

      const planSnapshot = result[0];

      // Update timeline
      await this.updateTimeline(entry.user_id, entry.year, planSnapshot.snapshot_timestamp, 'plan', Object.keys(entry.day_contents).length);

      // Update daily snapshot
      await this.updateDailySnapshotAfterPlan(entry.user_id, entry.year, entry.day_contents);

      // Direct return with day_contents
      return {
        ...planSnapshot,
        day_contents: entry.day_contents
      };
    } catch (error) {
      console.error("Error creating plan snapshot:", error);
      throw error;
    }
  }

  async createRealitySnapshot(entry: InsertJournalRealityMatrix): Promise<JournalRealityMatrix> {
    try {
      // Direct mapping - day_contents already matches database columns!
      const result = await db.insert(journalRealityMatrix).values({
        user_id: entry.user_id,
        snapshot_timestamp: entry.snapshot_timestamp,
        year: entry.year,
        ...entry.day_contents, // Direct spread - no conversion needed!
        total_reality_days: Object.values(entry.day_contents).filter(content => content !== null && content !== '').length,
        metadata: entry.metadata
      }).returning();

      const realitySnapshot = result[0];

      // Update timeline
      await this.updateTimeline(entry.user_id, entry.year, realitySnapshot.snapshot_timestamp, 'reality', Object.keys(entry.day_contents).length);

      // Update daily snapshot
      await this.updateDailySnapshotAfterReality(entry.user_id, entry.year, entry.day_contents);

      // Direct return with day_contents
      return {
        ...realitySnapshot,
        day_contents: entry.day_contents
      };
    } catch (error) {
      console.error("Error creating reality snapshot:", error);
      throw error;
    }
  }

  async getPlanSnapshot(userId: string, timestamp: string): Promise<JournalPlanMatrix | undefined> {
    try {
      const result = await db.select().from(journalPlanMatrix)
        .where(and(
          eq(journalPlanMatrix.user_id, userId),
          eq(journalPlanMatrix.snapshot_timestamp, new Date(timestamp))
        )).limit(1);
      const row = result[0];
      if (!row) return undefined;
      const day_contents: DayContents = {};
      for (let i = 1; i <= 365; i++) {
        const key = `day_${String(i).padStart(3, '0')}` as keyof typeof journalPlanMatrix;
        // @ts-expect-error dynamic access
        const value = (row as any)[key];
        if (value !== null && value !== undefined) {
          // @ts-expect-error dynamic assign
          day_contents[key as string] = value;
        }
      }
      return { ...(row as any), day_contents } as any;
    } catch (error) {
      console.error("Error getting plan snapshot:", error);
      return undefined;
    }
  }

  async getRealitySnapshot(userId: string, timestamp: string): Promise<JournalRealityMatrix | undefined> {
    try {
      const result = await db.select().from(journalRealityMatrix)
        .where(and(
          eq(journalRealityMatrix.user_id, userId),
          eq(journalRealityMatrix.snapshot_timestamp, new Date(timestamp))
        )).limit(1);
      const row = result[0];
      if (!row) return undefined;
      const day_contents: DayContents = {};
      for (let i = 1; i <= 365; i++) {
        const key = `day_${String(i).padStart(3, '0')}` as keyof typeof journalRealityMatrix;
        // @ts-expect-error dynamic access
        const value = (row as any)[key];
        if (value !== null && value !== undefined) {
          // @ts-expect-error dynamic assign
          day_contents[key as string] = value;
        }
      }
      return { ...(row as any), day_contents } as any;
    } catch (error) {
      console.error("Error getting reality snapshot:", error);
      return undefined;
    }
  }

  async getAllPlanSnapshots(userId: string, year: number): Promise<JournalPlanMatrix[]> {
    try {
      const rows = await db.select().from(journalPlanMatrix)
        .where(and(
          eq(journalPlanMatrix.user_id, userId),
          eq(journalPlanMatrix.year, year)
        ))
        .orderBy(journalPlanMatrix.snapshot_timestamp);
      return rows.map((row: any) => {
        const day_contents: DayContents = {};
        for (let i = 1; i <= 365; i++) {
          const key = `day_${String(i).padStart(3, '0')}`;
          const value = row[key];
          if (value !== null && value !== undefined) day_contents[key] = value;
        }
        return { ...row, day_contents } as any;
      });
    } catch (error) {
      console.error("Error getting all plan snapshots:", error);
      return [];
    }
  }

  async getAllRealitySnapshots(userId: string, year: number): Promise<JournalRealityMatrix[]> {
    try {
      const rows = await db.select().from(journalRealityMatrix)
        .where(and(
          eq(journalRealityMatrix.user_id, userId),
          eq(journalRealityMatrix.year, year)
        ))
        .orderBy(journalRealityMatrix.snapshot_timestamp);
      return rows.map((row: any) => {
        const day_contents: DayContents = {};
        for (let i = 1; i <= 365; i++) {
          const key = `day_${String(i).padStart(3, '0')}`;
          const value = row[key];
          if (value !== null && value !== undefined) day_contents[key] = value;
        }
        return { ...row, day_contents } as any;
      });
    } catch (error) {
      console.error("Error getting all reality snapshots:", error);
      return [];
    }
  }

  // Daily snapshot operations
  async getDailySnapshot(userId: string, year: number): Promise<DailySnapshot | undefined> {
    try {
      const result = await db.select().from(dailySnapshots)
        .where(and(
          eq(dailySnapshots.user_id, userId),
          eq(dailySnapshots.year, year)
        ))
        .orderBy(desc(dailySnapshots.updated_at))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting daily snapshot:", error);
      return undefined;
    }
  }

  async updateDailySnapshot(snapshot: InsertDailySnapshot): Promise<DailySnapshot> {
    try {
      const existing = await this.getDailySnapshot(snapshot.user_id, snapshot.year);

      if (existing) {
        // Update existing
        const result = await db.update(dailySnapshots)
          .set({
            ...snapshot,
            completion_rate: this.calculateCompletionRate(snapshot.latest_plan_contents, snapshot.latest_reality_contents),
            updated_at: new Date()
          })
          .where(eq(dailySnapshots.id, existing.id))
          .returning();
        return result[0];
      } else {
        // Create new
        const result = await db.insert(dailySnapshots)
          .values({
            ...snapshot,
            completion_rate: this.calculateCompletionRate(snapshot.latest_plan_contents, snapshot.latest_reality_contents),
          })
          .returning();
        return result[0];
      }
    } catch (error) {
      console.error("Error updating daily snapshot:", error);
      throw error;
    }
  }

  // Time Machine operations
  async getTimeline(userId: string, year: number): Promise<TimelineIndex[]> {
    try {
      return await db.select().from(timelineIndex)
        .where(and(
          eq(timelineIndex.user_id, userId),
          eq(timelineIndex.year, year)
        ))
        .orderBy(timelineIndex.timestamp);
    } catch (error) {
      console.error("Error getting timeline:", error);
      return [];
    }
  }

  async getTimeMachineSnapshot(userId: string, timestamp: string, year: number): Promise<TimeMachineSnapshot> {
    const planSnapshot = await this.getPlanSnapshot(userId, timestamp);
    const realitySnapshot = await this.getRealitySnapshot(userId, timestamp);
    try {
      // debug log limited output
      console.log("[TimeMachine] plan day_001:", (planSnapshot as any)?.day_001);
    } catch {}

    return {
      timestamp,
      year,
      plan_contents: planSnapshot ? this.extractDayContentsFromRow(planSnapshot as any) : {},
      reality_contents: realitySnapshot ? this.extractDayContentsFromRow(realitySnapshot as any) : {},
      metadata: planSnapshot?.metadata || realitySnapshot?.metadata,
    };
  }

  async compareTimeMachineSnapshots(userId: string, timestamp1: string, timestamp2: string, year: number): Promise<TimeMachineComparison> {
    const snapshot1 = await this.getTimeMachineSnapshot(userId, timestamp1, year);
    const snapshot2 = await this.getTimeMachineSnapshot(userId, timestamp2, year);

    const planDiff = this.generateDiff(snapshot1.plan_contents, snapshot2.plan_contents);
    const realityDiff = this.generateDiff(snapshot1.reality_contents, snapshot2.reality_contents);

    return {
      timestamp1,
      timestamp2,
      year,
      plan_diff: planDiff,
      reality_diff: realityDiff,
    };
  }

  async exportYearData(userId: string, year: number) {
    return {
      planSnapshots: await this.getAllPlanSnapshots(userId, year),
      realitySnapshots: await this.getAllRealitySnapshots(userId, year),
      dailySnapshot: await this.getDailySnapshot(userId, year),
      timeline: await this.getTimeline(userId, year),
    };
  }

  // Helper methods
  private async updateTimeline(userId: string, year: number, timestamp: Date, entryType: string, changesCount: number): Promise<void> {
    try {
      await db.insert(timelineIndex).values({
        user_id: userId,
        timestamp,
        year,
        entry_type: entryType,
        changes_count: changesCount,
        description: `Updated ${changesCount} days of ${entryType}`,
      });
    } catch (error) {
      console.error("Error updating timeline:", error);
    }
  }

  private async updateDailySnapshotAfterPlan(userId: string, year: number, dayContents: DayContents): Promise<void> {
    const existing = await this.getDailySnapshot(userId, year);
    const now = new Date();

    const updated: InsertDailySnapshot = {
      user_id: userId,
      snapshot_date: now,
      year,
      latest_plan_contents: dayContents,
      latest_reality_contents: existing?.latest_reality_contents || {},
      plan_last_updated: now,
      reality_last_updated: existing?.reality_last_updated || null,
    };

    await this.updateDailySnapshot(updated);
  }

  private async updateDailySnapshotAfterReality(userId: string, year: number, dayContents: DayContents): Promise<void> {
    const existing = await this.getDailySnapshot(userId, year);
    const now = new Date();

    const updated: InsertDailySnapshot = {
      user_id: userId,
      snapshot_date: now,
      year,
      latest_plan_contents: existing?.latest_plan_contents || {},
      latest_reality_contents: dayContents,
      plan_last_updated: existing?.plan_last_updated || null,
      reality_last_updated: now,
    };

    await this.updateDailySnapshot(updated);
  }

  private calculateCompletionRate(planContents: DayContents, realityContents: DayContents): number {
    const planDays = Object.keys(planContents).filter(key => planContents[key] !== null && planContents[key] !== '');
    const realityDays = Object.keys(realityContents).filter(key => realityContents[key] !== null && realityContents[key] !== '');

    if (planDays.length === 0) return 0;

    const completedDays = planDays.filter(day => realityDays.includes(day));
    return Math.round((completedDays.length / planDays.length) * 100);
  }

  private generateDiff(before: DayContents, after: DayContents) {
    const allDays = new Set([...Object.keys(before), ...Object.keys(after)]);

    return Array.from(allDays).map(day => {
      const beforeContent = before[day];
      const afterContent = after[day];

      if (!beforeContent && !afterContent) {
        return { day, before: null, after: null, status: 'unchanged' as const };
      } else if (!beforeContent && afterContent) {
        return { day, before: null, after: afterContent, status: 'added' as const };
      } else if (beforeContent && !afterContent) {
        return { day, before: beforeContent, after: null, status: 'removed' as const };
      } else if (beforeContent !== afterContent) {
        return { day, before: beforeContent, after: afterContent, status: 'modified' as const };
      } else {
        return { day, before: beforeContent, after: afterContent, status: 'unchanged' as const };
      }
    });
  }

  private extractDayContentsFromRow(row: any): DayContents {
    const out: DayContents = {};
    for (let i = 1; i <= 365; i++) {
      const key = `day_${String(i).padStart(3, '0')}`;
      const v = row[key];
      if (v !== null && v !== undefined && v !== '') out[key] = v;
    }
    return out;
  }
}

export const storage = new SqliteStorage();
