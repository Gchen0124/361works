import {
  type User,
  type InsertUser,
  type DailySnapshot,
  type TimelineIndex,
  type InsertDailySnapshot,
  users,
  journalPlanMatrix,
  journalRealityMatrix,
  dailySnapshots,
  timelineIndex,
  type DayContents,
  type InsertJournalPlanMatrix,
  type InsertJournalRealityMatrix,
  type JournalPlanMatrix,
  type JournalRealityMatrix,
  type TimeMachineSnapshot,
  type TimeMachineComparison
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

// Google OAuth Profile interface
export interface GoogleProfile {
  id: string;
  email: string;
  displayName: string;
  photos?: Array<{ value: string }>;
}

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // OAuth operations
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createGoogleUser(profile: GoogleProfile): Promise<User>;
  updateUserLastLogin(userId: string): Promise<void>;

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

export class DatabaseStorage implements IStorage {
  private dayKeys: string[] = Array.from({ length: 365 }, (_, i) => `day_${String(i + 1).padStart(3, '0')}`);

  private emptyDayContents(): DayContents {
    const contents: DayContents = {};
    for (const k of this.dayKeys) contents[k] = null;
    return contents;
  }

  private mergeFullContents(previous: DayContents | undefined, incoming: DayContents): DayContents {
    const base = previous ? { ...previous } : this.emptyDayContents();
    for (const k of Object.keys(incoming)) {
      base[k] = incoming[k] ?? null;
    }
    for (const k of this.dayKeys) {
      if (!(k in base)) base[k] = null;
    }
    return base;
  }

  private countNonEmpty(contents: DayContents): number {
    return this.dayKeys.filter((k) => {
      const v = contents[k];
      return v !== null && v !== undefined && v !== '';
    }).length;
  }

  private diffCount(before: DayContents | undefined, after: DayContents): number {
    if (!before) return this.countNonEmpty(after);
    let c = 0;
    for (const k of this.dayKeys) {
      if ((before[k] || null) !== (after[k] || null)) c++;
    }
    return c;
  }

  private async getLatestPlanSnapshotRow(userId: string, year: number) {
    const [row] = await (db as any).select().from(journalPlanMatrix)
      .where(and(eq(journalPlanMatrix.userId, userId), eq(journalPlanMatrix.year, year)))
      .orderBy(desc(journalPlanMatrix.snapshotTimestamp))
      .limit(1);
    return row;
  }

  private async getLatestRealitySnapshotRow(userId: string, year: number) {
    const [row] = await (db as any).select().from(journalRealityMatrix)
      .where(and(eq(journalRealityMatrix.userId, userId), eq(journalRealityMatrix.year, year)))
      .orderBy(desc(journalRealityMatrix.snapshotTimestamp))
      .limit(1);
    return row;
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await (db as any).select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await (db as any).select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await (db as any).insert(users).values({
      ...insertUser,
      id: insertUser.id || crypto.randomUUID(),
    }).returning();
    return user;
  }

  // OAuth methods
  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await (db as any).select().from(users).where(eq(users.googleId, googleId));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await (db as any).select().from(users).where(eq(users.email, email));
    return user;
  }

  async createGoogleUser(profile: GoogleProfile): Promise<User> {
    const [user] = await (db as any)
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        username: profile.email || `google_${profile.id}`,
        password: null,
        googleId: profile.id,
        email: profile.email,
        displayName: profile.displayName,
        avatarUrl: profile.photos?.[0]?.value,
        authProvider: 'google',
        lastLogin: new Date(),
      })
      .returning();
    return user;
  }

  async updateUserLastLogin(userId: string): Promise<void> {
    await (db as any)
      .update(users)
      .set({
        lastLogin: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  // Matrix journal operations
  async createPlanSnapshot(entry: InsertJournalPlanMatrix): Promise<JournalPlanMatrix> {
    // The entry comes with `day_contents` from the frontend (via routes adapter) or we need to adapt it.
    // The schema expects `day_001`, `day_002` etc directly in the insert object.
    // But the `InsertJournalPlanMatrix` type is generated from the schema, so it HAS `day_001` etc.
    // However, the frontend sends `day_contents` map.
    // We need to handle this mapping in the route or here.
    // The previous implementation did:
    // `const fullContents = this.mergeFullContents(latestContents, entry.day_contents);`
    // So `entry` passed to this function was NOT `InsertJournalPlanMatrix` strictly, but a DTO.
    // Let's assume `entry` passed here is the DTO with `day_contents`.
    // Wait, TypeScript will complain if we don't match the interface.
    // The interface says `createPlanSnapshot(entry: InsertJournalPlanMatrix)`.
    // `InsertJournalPlanMatrix` has `day_001`...`day_365`.
    // So the caller (route) must prepare this object.
    // BUT, we need to merge with previous state!
    // So we need the `day_contents` map to do the merge logic easily.

    // Let's change the signature to accept what we need.
    // Actually, let's stick to the logic:
    // 1. Get latest snapshot.
    // 2. Merge new data.
    // 3. Insert new row.

    // We will accept `any` for entry to allow passing `day_contents` and map it.
    // Or better, define a DTO.

    const input = entry as any; // { user_id, year, day_contents, metadata ... }

    const latestRow = await this.getLatestPlanSnapshotRow(input.user_id, input.year);
    const latestContents = latestRow ? this.extractDayContentsFromRow(latestRow) : undefined;
    const fullContents = this.mergeFullContents(latestContents, input.day_contents || {}); // input.day_contents is the new data

    const rowToInsert: any = {
      userId: input.user_id,
      snapshotTimestamp: new Date(),
      year: input.year,
      ...fullContents,
      totalPlannedDays: this.countNonEmpty(fullContents),
      metadata: input.metadata
    };

    const [planSnapshot] = await (db as any).insert(journalPlanMatrix).values(rowToInsert).returning();

    const changes = this.diffCount(latestContents, fullContents);
    await this.updateTimeline(input.user_id, input.year, planSnapshot.snapshotTimestamp, 'plan', changes);

    await this.updateDailySnapshotAfterPlan(input.user_id, input.year, fullContents);

    return {
      ...planSnapshot,
      day_contents: fullContents
    } as any;
  }

  async createRealitySnapshot(entry: InsertJournalRealityMatrix): Promise<JournalRealityMatrix> {
    const input = entry as any;

    const latestRow = await this.getLatestRealitySnapshotRow(input.user_id, input.year);
    const latestContents = latestRow ? this.extractDayContentsFromRow(latestRow) : undefined;
    const fullContents = this.mergeFullContents(latestContents, input.day_contents || {});

    const rowToInsert: any = {
      userId: input.user_id,
      snapshotTimestamp: new Date(),
      year: input.year,
      ...fullContents,
      totalRealityDays: this.countNonEmpty(fullContents),
      metadata: input.metadata
    };

    const [realitySnapshot] = await (db as any).insert(journalRealityMatrix).values(rowToInsert).returning();

    const changes = this.diffCount(latestContents, fullContents);
    await this.updateTimeline(input.user_id, input.year, realitySnapshot.snapshotTimestamp, 'reality', changes);

    await this.updateDailySnapshotAfterReality(input.user_id, input.year, fullContents);

    return {
      ...realitySnapshot,
      day_contents: fullContents
    } as any;
  }

  async getPlanSnapshot(userId: string, timestamp: string): Promise<JournalPlanMatrix | undefined> {
    const [row] = await (db as any).select().from(journalPlanMatrix)
      .where(and(
        eq(journalPlanMatrix.userId, userId),
        eq(journalPlanMatrix.snapshotTimestamp, new Date(timestamp))
      )).limit(1);

    if (!row) return undefined;
    const day_contents = this.extractDayContentsFromRow(row);
    return { ...row, day_contents } as any;
  }

  async getRealitySnapshot(userId: string, timestamp: string): Promise<JournalRealityMatrix | undefined> {
    const [row] = await (db as any).select().from(journalRealityMatrix)
      .where(and(
        eq(journalRealityMatrix.userId, userId),
        eq(journalRealityMatrix.snapshotTimestamp, new Date(timestamp))
      )).limit(1);

    if (!row) return undefined;
    const day_contents = this.extractDayContentsFromRow(row);
    return { ...row, day_contents } as any;
  }

  async getAllPlanSnapshots(userId: string, year: number): Promise<JournalPlanMatrix[]> {
    const rows = await (db as any).select().from(journalPlanMatrix)
      .where(and(
        eq(journalPlanMatrix.userId, userId),
        eq(journalPlanMatrix.year, year)
      ))
      .orderBy(journalPlanMatrix.snapshotTimestamp);

    return rows.map((row) => {
      const day_contents = this.extractDayContentsFromRow(row);
      return { ...row, day_contents } as any;
    });
  }

  async getAllRealitySnapshots(userId: string, year: number): Promise<JournalRealityMatrix[]> {
    const rows = await (db as any).select().from(journalRealityMatrix)
      .where(and(
        eq(journalRealityMatrix.userId, userId),
        eq(journalRealityMatrix.year, year)
      ))
      .orderBy(journalRealityMatrix.snapshotTimestamp);

    return rows.map((row) => {
      const day_contents = this.extractDayContentsFromRow(row);
      return { ...row, day_contents } as any;
    });
  }

  // Daily snapshot operations
  async getDailySnapshot(userId: string, year: number): Promise<DailySnapshot | undefined> {
    const [snapshot] = await (db as any).select().from(dailySnapshots)
      .where(and(
        eq(dailySnapshots.userId, userId),
        eq(dailySnapshots.year, year)
      ))
      .orderBy(desc(dailySnapshots.snapshotDate))
      .limit(1);
    return snapshot;
  }

  async updateDailySnapshot(snapshot: any): Promise<DailySnapshot> {
    const existing = await this.getDailySnapshot(snapshot.userId, snapshot.year);

    // Cast jsonb fields to DayContents for calculation
    const planContents = (snapshot.latestPlanContents as unknown) as DayContents;
    const realityContents = (snapshot.latestRealityContents as unknown) as DayContents;
    const completionRate = this.calculateCompletionRate(planContents, realityContents);

    if (existing) {
      const [updated] = await (db as any).update(dailySnapshots)
        .set({
          ...snapshot,
          completionRate,
          snapshotDate: new Date() // Update timestamp
        })
        .where(eq((dailySnapshots.id as any), (existing.id as any)))
        .returning();
      return updated;
    } else {
      const [created] = await (db as any).insert(dailySnapshots)
        .values({
          ...snapshot,
          completionRate,
        })
        .returning();
      return created;
    }
  }

  // Time Machine operations
  async getTimeline(userId: string, year: number): Promise<TimelineIndex[]> {
    return await (db as any).select().from(timelineIndex)
      .where(and(
        eq(timelineIndex.userId, userId),
        eq(timelineIndex.year, year)
      ))
      .orderBy(timelineIndex.timestamp);
  }

  async getTimeMachineSnapshot(userId: string, timestamp: string, year: number): Promise<TimeMachineSnapshot> {
    const planSnapshot = await this.getPlanSnapshot(userId, timestamp);
    const realitySnapshot = await this.getRealitySnapshot(userId, timestamp);

    return {
      timestamp,
      year,
      plan_contents: planSnapshot ? (planSnapshot as any).day_contents : {},
      reality_contents: realitySnapshot ? (realitySnapshot as any).day_contents : {},
      metadata: (planSnapshot?.metadata as Record<string, any> | undefined) || (realitySnapshot?.metadata as Record<string, any> | undefined),
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
    await db.insert(timelineIndex).values({
      userId,
      timestamp,
      year,
      entryType,
      changesCount,
      description: `Updated ${changesCount} days of ${entryType}`,
    });
  }

  private async updateDailySnapshotAfterPlan(userId: string, year: number, dayContents: DayContents): Promise<void> {
    const existing = await this.getDailySnapshot(userId, year);
    const now = new Date();

    const updated: any = {
      userId,
      snapshotDate: now,
      year,
      latestPlanContents: dayContents,
      latestRealityContents: (existing?.latestRealityContents as any) || {},
      planLastUpdated: now,
      realityLastUpdated: existing?.realityLastUpdated || null,
    };

    await this.updateDailySnapshot(updated);
  }

  private async updateDailySnapshotAfterReality(userId: string, year: number, dayContents: DayContents): Promise<void> {
    const existing = await this.getDailySnapshot(userId, year);
    const now = new Date();

    const updated: any = {
      userId,
      snapshotDate: now,
      year,
      latestPlanContents: (existing?.latestPlanContents as any) || {},
      latestRealityContents: dayContents,
      planLastUpdated: existing?.planLastUpdated || null,
      realityLastUpdated: now,
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
    const out: DayContents = {} as DayContents;
    for (const key of this.dayKeys) {
      const v = row[key];
      out[key] = v ?? null;
    }
    return out;
  }
}

export const storage = new DatabaseStorage();
