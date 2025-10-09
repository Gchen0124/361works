// Script to update routes.ts with auth middleware
// This shows the pattern - all routes need:
// 1. Add requireAuth middleware
// 2. Remove :userId from URL
// 3. Use req.userId instead

// POST /api/matrix/reality - NEEDS UPDATE
app.post("/api/matrix/reality", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const validatedEntry = insertJournalRealityMatrixSchema.parse({
    ...req.body,
    user_id: userId,
  });
  // rest of code...
});

// GET /api/matrix/:year/daily - NEEDS UPDATE (remove :userId)
app.get("/api/matrix/daily/:year", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const { year } = req.params;
  const dailySnapshot = await storage.getDailySnapshot(userId, yearNum);
  // rest of code...
});

// GET /api/matrix/plans/:year - NEEDS UPDATE
app.get("/api/matrix/plans/:year", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const { year } = req.params;
  const snapshots = await storage.getAllPlanSnapshots(userId, yearNum);
  // rest of code...
});

// GET /api/matrix/realities/:year - NEEDS UPDATE
app.get("/api/matrix/realities/:year", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const { year } = req.params;
  const snapshots = await storage.getAllRealitySnapshots(userId, yearNum);
  // rest of code...
});

// Same pattern for:
// - /api/timemachine/* routes
// - /api/export/* routes
// - All other routes with :userId
