-- Migration: Add weekly plan/reality data fields to daily_snapshots
-- Date: 2025-11-14

ALTER TABLE daily_snapshots ADD COLUMN latest_weekly_plan_contents TEXT;
ALTER TABLE daily_snapshots ADD COLUMN latest_weekly_reality_contents TEXT;
ALTER TABLE daily_snapshots ADD COLUMN weekly_plan_last_updated INTEGER;
ALTER TABLE daily_snapshots ADD COLUMN weekly_reality_last_updated INTEGER;
ALTER TABLE daily_snapshots ADD COLUMN weekly_completion_rate INTEGER DEFAULT 0;
