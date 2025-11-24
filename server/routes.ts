import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import cookieParser from 'cookie-parser';
import { requireAuth, optionalAuth } from './auth/middleware';
import { handleGoogleOneTap } from './auth/google-one-tap';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validation schemas for API requests
const matrixUpdateSchema = z.object({
  user_id: z.string(),
  year: z.number(),
  day_contents: z.record(z.string().nullable()), // { day_001: "content" }
  metadata: z.any().optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {

  // ==================== SETUP ====================

  // Cookie parser (for JWT extraction)
  app.use(cookieParser());

  // ==================== AUTH ROUTES ====================

  // Google One Tap Sign-In (Modern approach)
  app.post('/api/auth/google', handleGoogleOneTap);

  // Logout
  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.json({ message: 'Logged out successfully' });
  });

  // Get current user from JWT
  app.get('/api/auth/me', optionalAuth, (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    res.json(req.user);
  });

  // ==================== MATRIX JOURNAL ROUTES ====================

  // POST /api/matrix/plan - Create planning snapshot
  app.post("/api/matrix/plan", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!; // From requireAuth middleware

      const validated = matrixUpdateSchema.parse({
        ...req.body,
        user_id: userId, // Override with authenticated userId
      });

      // Map snake_case API to camelCase Schema
      const entry: any = {
        userId: validated.user_id,
        year: validated.year,
        day_contents: validated.day_contents,
        metadata: validated.metadata
      };

      const result = await storage.createPlanSnapshot(entry);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating plan snapshot:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/matrix/reality - Create reality snapshot
  app.post("/api/matrix/reality", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;

      const validated = matrixUpdateSchema.parse({
        ...req.body,
        user_id: userId,
      });

      const entry: any = {
        userId: validated.user_id,
        year: validated.year,
        day_contents: validated.day_contents,
        metadata: validated.metadata
      };

      const result = await storage.createRealitySnapshot(entry);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating reality snapshot:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/matrix/:userId/:year/daily - Get daily snapshot (latest plan/reality)
  app.get("/api/matrix/:userId/:year/daily", async (req, res) => {
    try {
      const { userId, year } = req.params;
      const yearNum = parseInt(year);

      if (isNaN(yearNum)) {
        return res.status(400).json({ message: "Invalid year" });
      }

      const dailySnapshot = await storage.getDailySnapshot(userId, yearNum);

      if (!dailySnapshot) {
        return res.status(404).json({ message: "Daily snapshot not found" });
      }

      res.json(dailySnapshot);
    } catch (error) {
      console.error("Error fetching daily snapshot:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/matrix/:userId/:year/plans - Get all plan snapshots for year
  // NOTE: In the new schema, we don't return "snapshots" (history rows) in the same way.
  // We return the current state. The frontend might expect an array.
  // If the frontend expects an array of snapshots, we might need to adjust.
  // But `getAllPlanSnapshots` in previous storage returned `JournalPlanMatrix[]`.
  // Let's see what `storage.getPlanMatrix` returns. It returns `JournalMatrix` (single object).
  // If the frontend expects an array, we should wrap it or change frontend.
  // The previous code: `return rows.map(...)`.
  // The frontend `getAllSnapshots` expects `JournalSnapshot[]`.
  // If we only have the latest state, we return an array of 1?
  app.get("/api/matrix/:userId/:year/plans", async (req, res) => {
    try {
      const { userId, year } = req.params;
      const yearNum = parseInt(year);

      if (isNaN(yearNum)) {
        return res.status(400).json({ message: "Invalid year" });
      }

      const matrix = await storage.getPlanMatrix(userId, yearNum);
      // Wrap in array to maintain API compatibility if possible, 
      // though the "snapshot" concept is slightly different now.
      // We construct a "snapshot" looking object.
      const snapshot = {
        ...matrix,
        snapshot_timestamp: new Date(), // Fake timestamp for now
        day_contents: matrix.dayContents
      };

      res.json([snapshot]);
    } catch (error) {
      console.error("Error fetching plan snapshots:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/matrix/:userId/:year/realities - Get all reality snapshots for year
  app.get("/api/matrix/:userId/:year/realities", async (req, res) => {
    try {
      const { userId, year } = req.params;
      const yearNum = parseInt(year);

      if (isNaN(yearNum)) {
        return res.status(400).json({ message: "Invalid year" });
      }

      const matrix = await storage.getRealityMatrix(userId, yearNum);
      const snapshot = {
        ...matrix,
        snapshot_timestamp: new Date(),
        day_contents: matrix.dayContents
      };
      res.json([snapshot]);
    } catch (error) {
      console.error("Error fetching reality snapshots:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== TIME MACHINE ROUTES ====================

  // GET /api/timemachine/:userId/:year/timeline - Get timeline for Time Machine scrubbing
  app.get("/api/timemachine/:userId/:year/timeline", async (req, res) => {
    try {
      const { userId, year } = req.params;
      const yearNum = parseInt(year);

      if (isNaN(yearNum)) {
        return res.status(400).json({ message: "Invalid year" });
      }

      const timeline = await storage.getTimeline(userId, yearNum);
      res.json(timeline);
    } catch (error) {
      console.error("Error fetching timeline:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/timemachine/:userId/:year/snapshot/:timestamp
  // This is harder now. We are not storing full snapshots for every edit.
  // We are storing individual entries.
  // To reconstruct a snapshot at a time T, we need to query journal_entries where updatedAt <= T.
  // This is complex "temporal database" stuff.
  // For now, we might just return the current state and warn, or implement a basic version.
  // Given the scope, let's return the current state but maybe TODO: implement real time travel.
  // OR, since we kept `timelineIndex`, we have the markers.
  // But we didn't implement `getTimeMachineSnapshot` in `DatabaseStorage` yet.
  // Let's add a placeholder or simple implementation.
  app.get("/api/timemachine/:userId/:year/snapshot/:timestamp", async (req, res) => {
    // Placeholder: return current state
    const { userId, year } = req.params;
    const yearNum = parseInt(year);
    const plan = await storage.getPlanMatrix(userId, yearNum);
    const reality = await storage.getRealityMatrix(userId, yearNum);

    res.json({
      timestamp: req.params.timestamp,
      year: yearNum,
      plan_contents: plan.dayContents,
      reality_contents: reality.dayContents,
      metadata: {}
    });
  });

  // ==================== EXPORT ROUTES ====================

  // GET /api/export/:userId/:year - Export full year data
  app.get("/api/export/:userId/:year", async (req, res) => {
    try {
      const { userId, year } = req.params;
      const { format = 'json' } = req.query;
      const yearNum = parseInt(year);

      if (isNaN(yearNum)) {
        return res.status(400).json({ message: "Invalid year" });
      }

      const exportData = await storage.exportYearData(userId, yearNum);

      if (format === 'csv') {
        // Generate CSV format for matrix data
        // We need to adapt generateMatrixCSV to the new data structure
        // const csvData = generateMatrixCSV(exportData);
        // res.setHeader('Content-Type', 'text/csv');
        // res.setHeader('Content-Disposition', `attachment; filename="journal-${userId}-${year}.csv"`);
        // res.send(csvData);
        res.status(501).send("CSV export temporarily unavailable during migration");
      } else {
        // JSON format
        res.json(exportData);
      }
    } catch (error) {
      console.error("Error exporting year data:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== UTILITY ROUTES ====================

  // GET /api/health - Health check
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      features: ["matrix-journal", "postgres-backend"]
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to generate CSV from matrix data
function generateMatrixCSV(exportData: any): string {
  const lines: string[] = [];

  // Header row - dates
  const dates = Array.from({ length: 365 }, (_, i) => {
    const date = new Date(2025, 0, 1); // Jan 1, 2025
    date.setDate(date.getDate() + i);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  lines.push(['timestamp', 'type', ...dates].join(','));

  // Plan snapshots
  exportData.planSnapshots.forEach((snapshot: any) => {
    const row = [
      snapshot.snapshot_timestamp,
      'plan',
      ...Array.from({ length: 365 }, (_, i) => {
        const dayKey = `day_${String(i + 1).padStart(3, '0')}`;
        const content = snapshot.day_contents[dayKey] || '';
        return `"${content.replace(/"/g, '""')}"`;
      })
    ];
    lines.push(row.join(','));
  });

  // Reality snapshots
  exportData.realitySnapshots.forEach((snapshot: any) => {
    const row = [
      snapshot.snapshot_timestamp,
      'reality',
      ...Array.from({ length: 365 }, (_, i) => {
        const dayKey = `day_${String(i + 1).padStart(3, '0')}`;
        const content = snapshot.day_contents[dayKey] || '';
        return `"${content.replace(/"/g, '""')}"`;
      })
    ];
    lines.push(row.join(','));
  });

  return lines.join('\n');
}
