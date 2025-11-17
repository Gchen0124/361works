# Database Setup Guide - Neon PostgreSQL Integration

## 🎯 What Was Fixed

This guide documents the complete database integration fixes that were implemented to resolve the following issues:

### Issues Fixed ✅

1. **Database Not Connected to Neon**
   - ❌ **Before:** All data was saving to local SQLite (`./data/dailyglass.db`)
   - ✅ **After:** Data now saves to Neon PostgreSQL cloud database when configured

2. **Frontend Prioritizing localStorage Over Database**
   - ❌ **Before:** Frontend always loaded from localStorage first, causing stale data display
   - ✅ **After:** Frontend now prioritizes fresh database data when online

3. **Time Machine Feature Not Saving to Neon**
   - ❌ **Before:** Time machine snapshots saved to local SQLite only
   - ✅ **After:** All time machine snapshots now save to Neon database

4. **Port Mismatch**
   - ❌ **Before:** Frontend expected port 5001, server ran on port 5000
   - ✅ **After:** Aligned to port 5000 across the board

---

## 🚀 Quick Start

### Step 1: Get Your Neon Database URL

1. Go to [Neon Console](https://console.neon.tech)
2. Create a new project or select existing project
3. Copy your connection string (it looks like):
   ```
   postgresql://user:password@ep-cool-name-123456.us-east-2.aws.neon.tech/dbname?sslmode=require
   ```

### Step 2: Configure Environment

1. Open `.env` file in the project root
2. Add your Neon database URL:
   ```bash
   DATABASE_URL=postgresql://your-connection-string-here
   PORT=5000
   NODE_ENV=development
   ```

### Step 3: Generate and Run Migrations

```bash
# Generate PostgreSQL migrations
npm run db:generate

# Push schema to your Neon database
npm run db:push

# Initialize database and create default user
npm run db:setup
```

### Step 4: Start the Application

```bash
npm run dev
```

The app will now:
- ✅ Connect to Neon PostgreSQL
- ✅ Save all journal entries to cloud database
- ✅ Sync time machine snapshots to Neon
- ✅ Pull fresh data from database on load
- ✅ Fallback to localStorage when offline

---

## 🏗️ Architecture Changes

### Database Connection Layer

**File:** `server/db.ts`

The database connection now:
- Detects if `DATABASE_URL` is set
- Uses Neon PostgreSQL when URL contains 'neon.tech'
- Falls back to SQLite for local development
- Runs appropriate migrations automatically

```typescript
const USE_NEON = DATABASE_URL?.includes('neon.tech');

if (USE_NEON) {
  // Use Neon PostgreSQL
  const sql = neon(DATABASE_URL);
  db = drizzleNeon(sql, { schema });
} else {
  // Fallback to SQLite
  const sqlite = new Database("./data/dailyglass.db");
  db = drizzleSqlite(sqlite, { schema });
}
```

### Schema Files

**Files:**
- `shared/schema.ts` - Conditional loader
- `shared/schema.postgres.ts` - PostgreSQL-specific schema
- `shared/schema.sqlite.ts` - SQLite-specific schema

The schema loader automatically imports the correct schema based on database type:

```typescript
if (USE_NEON) {
  export * from "./schema.postgres";
} else {
  export * from "./schema.sqlite";
}
```

### Frontend Data Loading Priority

**File:** `client/src/hooks/useJournalData.ts`

**New Priority Order:**
1. **Check if online** → API health check
2. **If online** → Load from database (Neon)
3. **Update localStorage** with fresh database data
4. **If offline or error** → Fallback to localStorage

```typescript
if (isOnline) {
  // Load from database (Neon)
  const snapshot = await journalAPI.getDailySnapshot(year);
  planEntries = snapshot.latest_plan_contents;
  realityEntries = snapshot.latest_reality_contents;

  // Update localStorage as cache
  localStorage.setItem(`journal-plan-${year}`, JSON.stringify(planEntries));
} else {
  // Offline fallback
  planEntries = loadFromLocalStorage(`journal-plan-${year}`, year);
}
```

### API Client Configuration

**File:** `client/src/lib/journalAPI.ts`

Fixed port configuration:
```typescript
private baseURL = process.env.VITE_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:5000`;
```

---

## 📊 Database Schema

### Tables

1. **users** - User accounts
   - `id` (text/uuid) - User identifier
   - `username` - Unique username
   - `password` - Hashed password
   - `created_at` - Account creation timestamp

2. **journal_plan_matrix** - Planning snapshots
   - `id` (serial/autoincrement) - Snapshot ID
   - `user_id` - FK to users.id
   - `snapshot_timestamp` - When snapshot was created
   - `year` - Year (e.g., 2025)
   - `day_001` to `day_365` - Individual day contents
   - `total_planned_days` - Count of non-empty days
   - `metadata` - JSON metadata

3. **journal_reality_matrix** - Reality snapshots
   - Same structure as plan matrix
   - Stores what actually happened vs what was planned

4. **daily_snapshots** - Latest snapshot cache
   - `latest_plan_contents` - Current state of all 365 plan days
   - `latest_reality_contents` - Current state of all 365 reality days
   - `completion_rate` - Percentage of plans that became reality
   - Timestamps for last updates

5. **timeline_index** - Time machine timeline
   - `timestamp` - Snapshot timestamp
   - `entry_type` - 'plan' or 'reality'
   - `changes_count` - Number of days modified
   - `description` - Human-readable description

---

## ⏰ Time Machine Feature

### How It Works with Neon

1. **User edits a day**
   - Frontend updates localStorage immediately (instant feedback)
   - Triggers auto-save to database (2-second debounce)

2. **Auto-save creates snapshot**
   ```typescript
   POST /api/matrix/plan or /api/matrix/reality
   {
     user_id: "default-user",
     snapshot_timestamp: "2025-01-17T10:30:00Z",
     year: 2025,
     day_contents: { day_001: "content", ... }
   }
   ```

3. **Backend saves to Neon**
   - Inserts new row in `journal_plan_matrix` or `journal_reality_matrix`
   - Updates `daily_snapshots` cache with latest state
   - Creates `timeline_index` entry for time machine scrubbing

4. **Time Machine Timeline**
   ```typescript
   GET /api/timemachine/:userId/:year/timeline

   Returns:
   [
     { timestamp: "2025-01-17T10:30:00Z", type: "plan", changes: 3 },
     { timestamp: "2025-01-17T14:15:00Z", type: "reality", changes: 1 },
     ...
   ]
   ```

5. **Scrubbing to Past State**
   ```typescript
   GET /api/timemachine/:userId/:year/snapshot/:timestamp

   Returns:
   {
     timestamp: "2025-01-17T10:30:00Z",
     plan_contents: { day_001: "...", day_002: "...", ... },
     reality_contents: { day_001: "...", ... }
   }
   ```

### Viewing Time Machine

1. Enable Time Machine mode in the UI
2. Drag the timeline scrubber to any timestamp
3. View your journal exactly as it was at that point in time
4. Compare plan vs reality at any snapshot

---

## 🔄 Data Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│                   USER EDITS DAY                    │
└─────────────────┬───────────────────────────────────┘
                  │
                  ├─► [1] localStorage (instant)
                  │
                  ├─► [2] Auto-save timer (2s debounce)
                  │
                  ▼
        ┌─────────────────────┐
        │  API: POST /matrix  │
        └─────────┬───────────┘
                  │
                  ▼
        ┌─────────────────────┐
        │   Neon PostgreSQL   │
        │  ┌───────────────┐  │
        │  │ Plan Matrix   │  │
        │  │ Reality Matrix│  │
        │  │ Daily Snapshot│  │
        │  │ Timeline Index│  │
        │  └───────────────┘  │
        └─────────┬───────────┘
                  │
    ┌─────────────┴─────────────┐
    ▼                           ▼
[Time Machine]              [Latest View]
GET /timemachine/*          GET /matrix/*/daily
```

---

## 🧪 Testing the Setup

### Test 1: Database Connection

```bash
npm run db:setup
```

Expected output:
```
🚀 Connecting to Neon PostgreSQL database...
✅ Neon database migrations completed successfully
✅ Default user created
   User ID: default-user
   Username: demo
```

### Test 2: Save to Database

1. Start the app: `npm run dev`
2. Open browser console (F12)
3. Edit any day in the journal
4. Look for console logs:
   ```
   🌐 Online - loading from database...
   ✅ Loaded from database: X plan, Y reality entries
   🔄 Auto-saved plan to database
   ```

### Test 3: Time Machine

1. Make several edits to different days (wait 2 seconds between edits)
2. Enable Time Machine mode
3. Drag the timeline scrubber
4. Verify you can see past states of your journal

### Test 4: Offline Fallback

1. Stop the server
2. Refresh the page
3. Check console:
   ```
   📴 Offline - loading from localStorage...
   ```
4. Verify your data still displays from localStorage cache

---

## 🛠️ Troubleshooting

### Issue: "No Neon DATABASE_URL found"

**Solution:** Make sure `.env` file exists with valid `DATABASE_URL`:
```bash
DATABASE_URL=postgresql://user:pass@host.neon.tech/db?sslmode=require
```

### Issue: "Failed to connect to database"

**Causes:**
1. Invalid connection string
2. Neon database suspended (free tier sleeps after inactivity)
3. Network/firewall blocking connection

**Solution:**
1. Verify connection string in Neon console
2. Wake up database by visiting Neon console
3. Check your network/firewall settings

### Issue: "Migration failed"

**Solution:**
```bash
# Delete old migrations (if switching from SQLite)
rm -rf drizzle/

# Generate fresh migrations for PostgreSQL
DATABASE_URL=your-neon-url npm run db:generate
npm run db:push
npm run db:setup
```

### Issue: "Data not syncing to Neon"

**Check:**
1. Is `isOnline` status showing as `true` in the UI?
2. Check browser console for API errors
3. Verify backend is running and accessible
4. Check Neon database isn't suspended

---

## 📝 Environment Variables Reference

### Required

```bash
# Neon PostgreSQL connection string
DATABASE_URL=postgresql://user:pass@host.neon.tech/db?sslmode=require
```

### Optional

```bash
# Server port (default: 5000)
PORT=5000

# Node environment
NODE_ENV=development

# SQLite fallback path (when DATABASE_URL not set)
LOCAL_SQLITE_PATH=./data/dailyglass.db

# Custom API URL for frontend (optional)
VITE_API_BASE_URL=http://localhost:5000
```

---

## 🚨 Important Notes

### Default User

The default user `default-user` is created automatically by `npm run db:setup`.

**In production**, you should:
1. Implement proper authentication (passport.js is already installed)
2. Remove the hardcoded user ID from `client/src/lib/journalAPI.ts:28`
3. Hash passwords (bcrypt is recommended)

### Data Migration from SQLite to Neon

If you have existing data in SQLite (`./data/dailyglass.db`), you'll need to:

1. Export from SQLite:
   ```bash
   npm run smoke  # Creates test data if needed
   # Export using SQLite tools
   ```

2. Import to Neon:
   ```bash
   # Use Neon's import tools or write a custom migration script
   ```

### Backup Strategy

- **Neon:** Automatic backups on paid tiers
- **Free tier:** Consider periodic exports:
  ```bash
  curl http://localhost:5000/api/export/default-user/2025 > backup.json
  ```

---

## 📚 Additional Resources

- [Neon Documentation](https://neon.tech/docs)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [React Query Docs](https://tanstack.com/query/latest)

---

## ✅ Verification Checklist

Before considering the setup complete, verify:

- [ ] `.env` file exists with valid `DATABASE_URL`
- [ ] `npm run db:setup` completes successfully
- [ ] Server starts without errors (`npm run dev`)
- [ ] Browser console shows "Online - loading from database"
- [ ] Editing a day triggers auto-save to database
- [ ] Time machine shows timeline of snapshots
- [ ] Offline mode falls back to localStorage
- [ ] Data persists after browser refresh

---

**Setup completed!** 🎉

Your DailyGlass journal is now fully integrated with Neon PostgreSQL cloud database. All your journal entries and time machine snapshots will be safely stored in the cloud.
