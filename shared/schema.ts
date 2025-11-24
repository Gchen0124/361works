import { pgTable, text, serial, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: text("id").primaryKey(), // We'll handle UUID generation in application or use default
  username: text("username").notNull().unique(),
  password: text("password"), // Nullable for OAuth users
  googleId: text("google_id").unique(),
  email: text("email").unique(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  authProvider: text("auth_provider").notNull().default('local'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastLogin: timestamp("last_login"),
});

// Helper to generate 365 day columns
const generateDayColumns = () => {
  const columns: Record<string, any> = {};
  for (let i = 1; i <= 365; i++) {
    const key = `day_${String(i).padStart(3, '0')}`;
    columns[key] = text(key);
  }
  return columns;
};

// Journal Plan Matrix - stores 365-day planning snapshots with timestamps
export const journalPlanMatrix = pgTable("journal_plan_matrix", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  snapshotTimestamp: timestamp("snapshot_timestamp").notNull(),
  year: integer("year").notNull(),
  ...generateDayColumns(),
  totalPlannedDays: integer("total_planned_days").default(0),
  metadata: jsonb("metadata"), // { mood, tags, etc. }
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userTimestampIdx: index("idx_plan_user_timestamp").on(table.userId, table.snapshotTimestamp),
  userYearIdx: index("idx_plan_user_year").on(table.userId, table.year),
}));

// Journal Reality Matrix - stores 365-day reality snapshots with timestamps
export const journalRealityMatrix = pgTable("journal_reality_matrix", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  snapshotTimestamp: timestamp("snapshot_timestamp").notNull(),
  year: integer("year").notNull(),
  ...generateDayColumns(),
  totalRealityDays: integer("total_reality_days").default(0),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userTimestampIdx: index("idx_reality_user_timestamp").on(table.userId, table.snapshotTimestamp),
  userYearIdx: index("idx_reality_user_year").on(table.userId, table.year),
}));

// Daily Snapshots - latest plan/reality content per day for quick access
export const dailySnapshots = pgTable("daily_snapshots", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  snapshotDate: timestamp("snapshot_date").notNull(),
  year: integer("year").notNull(),
  latestPlanContents: jsonb("latest_plan_contents").$type<DayContents>().notNull(),
  latestRealityContents: jsonb("latest_reality_contents").$type<DayContents>().notNull(),
  planLastUpdated: timestamp("plan_last_updated"),
  realityLastUpdated: timestamp("reality_last_updated"),
  completionRate: integer("completion_rate").default(0),
});

// Timeline Index for Time Machine
export const timelineIndex = pgTable("timeline_index", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  timestamp: timestamp("timestamp").notNull(),
  year: integer("year").notNull(),
  entryType: text("entry_type").notNull(), // 'plan' or 'reality'
  changesCount: integer("changes_count").notNull(),
  description: text("description"),
});

// Zod Schemas
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

// We need to define these manually or use a helper because createInsertSchema might be huge with 365 columns
// But createInsertSchema handles it.
export const insertJournalPlanMatrixSchema = createInsertSchema(journalPlanMatrix);
export const insertJournalRealityMatrixSchema = createInsertSchema(journalRealityMatrix);

export const insertDailySnapshotSchema = createInsertSchema(dailySnapshots);
export const selectDailySnapshotSchema = createSelectSchema(dailySnapshots);

export const insertTimelineIndexSchema = createInsertSchema(timelineIndex);
export const selectTimelineIndexSchema = createSelectSchema(timelineIndex);

// Types
export type User = z.infer<typeof selectUserSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type JournalPlanMatrix = z.infer<typeof insertJournalPlanMatrixSchema>; // Using insert schema as base for type
export type InsertJournalPlanMatrix = z.infer<typeof insertJournalPlanMatrixSchema>;

export type JournalRealityMatrix = z.infer<typeof insertJournalRealityMatrixSchema>;
export type InsertJournalRealityMatrix = z.infer<typeof insertJournalRealityMatrixSchema>;

export type DailySnapshot = z.infer<typeof selectDailySnapshotSchema>;
export type InsertDailySnapshot = z.infer<typeof insertDailySnapshotSchema>;

export type TimelineIndex = z.infer<typeof selectTimelineIndexSchema>;
export type InsertTimelineIndex = z.infer<typeof insertTimelineIndexSchema>;

// Helper types
export type DayContents = Record<string, string | null>;

export interface TimeMachineSnapshot {
  timestamp: string;
  year: number;
  plan_contents: DayContents;
  reality_contents: DayContents;
  metadata?: Record<string, any>;
}

export interface TimeMachineComparison {
  timestamp1: string;
  timestamp2: string;
  year: number;
  plan_diff: any[];
  reality_diff: any[];
}