import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertJournalPlanMatrixSchema,
  insertJournalRealityMatrixSchema,
  timeMachineSnapshotSchema,
  timeMachineComparisonSchema
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {

  // ==================== MATRIX JOURNAL ROUTES ====================

  // POST /api/matrix/plan - Create planning snapshot
  app.post("/api/matrix/plan", async (req, res) => {
    try {
      const validatedEntry = insertJournalPlanMatrixSchema.parse(req.body);
      const snapshot = await storage.createPlanSnapshot(validatedEntry);
      res.json(snapshot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating plan snapshot:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/matrix/reality - Create reality snapshot
  app.post("/api/matrix/reality", async (req, res) => {
    try {
      const validatedEntry = insertJournalRealityMatrixSchema.parse(req.body);
      const snapshot = await storage.createRealitySnapshot(validatedEntry);
      res.json(snapshot);
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
  app.get("/api/matrix/:userId/:year/plans", async (req, res) => {
    try {
      const { userId, year } = req.params;
      const yearNum = parseInt(year);

      if (isNaN(yearNum)) {
        return res.status(400).json({ message: "Invalid year" });
      }

      const snapshots = await storage.getAllPlanSnapshots(userId, yearNum);
      res.json(snapshots);
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

      const snapshots = await storage.getAllRealitySnapshots(userId, yearNum);
      res.json(snapshots);
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

  // GET /api/timemachine/:userId/:year/snapshot/:timestamp - Get specific timestamp snapshot
  app.get("/api/timemachine/:userId/:year/snapshot/:timestamp", async (req, res) => {
    try {
      const { userId, year, timestamp } = req.params;
      const yearNum = parseInt(year);

      if (isNaN(yearNum)) {
        return res.status(400).json({ message: "Invalid year" });
      }

      const snapshot = await storage.getTimeMachineSnapshot(userId, timestamp, yearNum);
      res.json(snapshot);
    } catch (error) {
      console.error("Error fetching Time Machine snapshot:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/timemachine/:userId/:year/compare - Compare two timestamps
  app.get("/api/timemachine/:userId/:year/compare", async (req, res) => {
    try {
      const { userId, year } = req.params;
      const { timestamp1, timestamp2 } = req.query;
      const yearNum = parseInt(year);

      if (isNaN(yearNum)) {
        return res.status(400).json({ message: "Invalid year" });
      }

      if (!timestamp1 || !timestamp2) {
        return res.status(400).json({ message: "Both timestamp1 and timestamp2 are required" });
      }

      const comparison = await storage.compareTimeMachineSnapshots(
        userId,
        timestamp1 as string,
        timestamp2 as string,
        yearNum
      );

      res.json(comparison);
    } catch (error) {
      console.error("Error comparing snapshots:", error);
      res.status(500).json({ message: "Internal server error" });
    }
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
        const csvData = generateMatrixCSV(exportData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="journal-${userId}-${year}.csv"`);
        res.send(csvData);
      } else {
        // JSON format
        res.json(exportData);
      }
    } catch (error) {
      console.error("Error exporting year data:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/export/:userId/:year/matrix-csv - Export matrix CSV (365-day columns)
  app.get("/api/export/:userId/:year/matrix-csv", async (req, res) => {
    try {
      const { userId, year } = req.params;
      const yearNum = parseInt(year);

      if (isNaN(yearNum)) {
        return res.status(400).json({ message: "Invalid year" });
      }

      const exportData = await storage.exportYearData(userId, yearNum);
      const csvData = generateMatrixCSV(exportData);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="journal-matrix-${userId}-${year}.csv"`);
      res.send(csvData);
    } catch (error) {
      console.error("Error exporting matrix CSV:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== UTILITY ROUTES ====================

  // GET /api/health - Health check
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      features: ["matrix-journal", "time-machine", "csv-export"]
    });
  });

  // GET /api/debug/:userId/:year - Debug information
  app.get("/api/debug/:userId/:year", async (req, res) => {
    try {
      const { userId, year } = req.params;
      const yearNum = parseInt(year);

      if (isNaN(yearNum)) {
        return res.status(400).json({ message: "Invalid year" });
      }

      const debug = {
        userId,
        year: yearNum,
        planSnapshots: (await storage.getAllPlanSnapshots(userId, yearNum)).length,
        realitySnapshots: (await storage.getAllRealitySnapshots(userId, yearNum)).length,
        hasDaily: !!(await storage.getDailySnapshot(userId, yearNum)),
        timelineEvents: (await storage.getTimeline(userId, yearNum)).length,
      };

      res.json(debug);
    } catch (error) {
      console.error("Error fetching debug info:", error);
      res.status(500).json({ message: "Internal server error" });
    }
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
