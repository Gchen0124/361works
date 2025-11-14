# DailyGlass Database Architecture & Data Flow

## 🏗️ Database Structure Overview

Your DailyGlass app uses a **365-day matrix structure** to store both PLAN and REALITY data for an entire year.

### **Database Tables:**

```
┌─────────────────────────────────────────────────────────────┐
│                        USERS                                 │
│  - id (PK)                                                   │
│  - username                                                  │
│  - password                                                  │
│  - created_at                                                │
└─────────────────────────────────────────────────────────────┘
                          ▲
                          │ Foreign Key (user_id)
                          │
    ┌─────────────────────┼─────────────────────┐
    │                     │                     │
    ▼                     ▼                     ▼
┌─────────────┐  ┌──────────────────┐  ┌───────────────┐
│PLAN MATRIX  │  │ REALITY MATRIX   │  │ DAILY         │
│             │  │                  │  │ SNAPSHOTS     │
│365 columns  │  │ 365 columns      │  │               │
│day_001...   │  │ day_001...       │  │ Latest data   │
│day_365      │  │ day_365          │  │               │
└─────────────┘  └──────────────────┘  └───────────────┘
```

---

## 📊 Table Details

### **1. users** (User Authentication)

| Column | Type | Description |
|--------|------|-------------|
| `id` | varchar(255) PRIMARY KEY | User ID (default: 'default-user') |
| `username` | text | Username |
| `password` | text | Hashed password |
| `created_at` | timestamp | When user was created |

**Purpose:** Stores user accounts. Currently uses a single default user for development.

---

### **2. journal_plan_matrix** (Plan Data - 365 Days)

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PRIMARY KEY | Auto-increment ID |
| `user_id` | varchar(255) FK → users.id | Which user this belongs to |
| `snapshot_timestamp` | timestamp | When this snapshot was created |
| `year` | integer | Calendar year (e.g., 2025) |
| **`day_001`** | text | **Jan 1 plan content** |
| **`day_002`** | text | **Jan 2 plan content** |
| **...** | text | **...** |
| **`day_365`** | text | **Dec 31 plan content** |
| `total_planned_days` | integer | Count of non-empty days |
| `metadata` | jsonb | Additional data (mood, tags, etc.) |
| `created_at` | timestamp | Row creation time |

**Purpose:** Stores **versioned snapshots** of your yearly PLAN. Each save creates a new row with ALL 365 days, enabling time-travel to see past versions.

**Indexes:**
- `idx_plan_user_timestamp` on (user_id, snapshot_timestamp)
- `idx_plan_user_year` on (user_id, year)

---

### **3. journal_reality_matrix** (Reality Data - 365 Days)

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PRIMARY KEY | Auto-increment ID |
| `user_id` | varchar(255) FK → users.id | Which user this belongs to |
| `snapshot_timestamp` | timestamp | When this snapshot was created |
| `year` | integer | Calendar year (e.g., 2025) |
| **`day_001`** | text | **Jan 1 reality content** |
| **`day_002`** | text | **Jan 2 reality content** |
| **...** | text | **...** |
| **`day_365`** | text | **Dec 31 reality content** |
| `total_reality_days` | integer | Count of non-empty days |
| `metadata` | jsonb | Additional data |
| `created_at` | timestamp | Row creation time |

**Purpose:** Stores **versioned snapshots** of your yearly REALITY (what actually happened). Same structure as plan_matrix.

**Indexes:**
- `idx_reality_user_timestamp` on (user_id, snapshot_timestamp)
- `idx_reality_user_year` on (user_id, year)

---

### **4. daily_snapshots** (Latest Data Cache)

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PRIMARY KEY | Auto-increment ID |
| `user_id` | varchar(255) FK → users.id | Which user this belongs to |
| `snapshot_date` | timestamp | Date of this snapshot |
| `year` | integer | Calendar year |
| **`latest_plan_contents`** | **jsonb** | **Latest plan data (all 365 days as JSON)** |
| **`latest_reality_contents`** | **jsonb** | **Latest reality data (all 365 days as JSON)** |
| `latest_weekly_plan_contents` | jsonb | Weekly plan data (week_001 to week_053) |
| `latest_weekly_reality_contents` | jsonb | Weekly reality data |
| `plan_last_updated` | timestamp | When plans were last modified |
| `reality_last_updated` | timestamp | When reality was last modified |
| `weekly_plan_last_updated` | timestamp | When weekly plans were updated |
| `weekly_reality_last_updated` | timestamp | When weekly reality was updated |
| `completion_rate` | integer | % of daily plans that became reality |
| `weekly_completion_rate` | integer | % of weekly plans completed |
| `created_at` | timestamp | Row creation |
| `updated_at` | timestamp | Last update |

**Purpose:** Fast access to **latest** plan/reality data without querying historical snapshots. Updated every time you save.

**Indexes:**
- `idx_daily_user_date` on (user_id, snapshot_date)
- `idx_daily_user_year` on (user_id, year)

---

### **5. timeline_index** (Time Machine Navigation)

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PRIMARY KEY | Auto-increment ID |
| `user_id` | varchar(255) FK → users.id | Which user |
| `timestamp` | timestamp | When change occurred |
| `year` | integer | Calendar year |
| `entry_type` | text | 'plan' or 'reality' |
| `changes_count` | integer | How many days were modified |
| `description` | text | Auto-generated description |
| `created_at` | timestamp | When logged |

**Purpose:** Tracks **every change** to enable the Time Machine feature. Shows you a timeline of when you made edits.

**Indexes:**
- `idx_timeline_user_timestamp` on (user_id, timestamp)
- `idx_timeline_user_year_type` on (user_id, year, entry_type)

---

## 🔄 Data Flow: Frontend → Database

### **How Data Saves:**

```
┌──────────────┐
│ User types   │
│ in journal   │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────┐
│ 1. LOCAL STORAGE (Immediate)         │
│    Key: "journal-plan-2025"          │
│    Value: { day_001: "...", ... }   │
└──────┬───────────────────────────────┘
       │
       ▼ (2-second debounce)
┌──────────────────────────────────────┐
│ 2. FRONTEND API CALL                 │
│    POST /api/matrix/plan             │
│    Body: {                           │
│      user_id: "default-user",        │
│      year: 2025,                     │
│      snapshot_timestamp: "2025-...", │
│      day_contents: {                 │
│        day_001: "Plan for Jan 1",   │
│        day_002: "Plan for Jan 2",   │
│        ...                           │
│        day_365: "Plan for Dec 31"   │
│      }                               │
│    }                                 │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ 3. BACKEND VALIDATION                │
│    - Validate with Zod schema        │
│    - Check user exists               │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ 4. DATABASE OPERATIONS               │
│    a) Get latest snapshot            │
│    b) Merge new data with old        │
│    c) Insert into journal_plan_matrix│
│    d) Update daily_snapshots         │
│    e) Create timeline_index entry    │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ 5. RESPONSE TO FRONTEND              │
│    { id: 123, ... snapshot data }    │
└──────────────────────────────────────┘
```

---

## 📝 Frontend Code Locations

### **1. Data Hook: `client/src/hooks/useJournalData.ts`**

**Responsibilities:**
- Load data from localStorage on mount
- Check API connectivity
- Auto-save to database (2-second debounce)
- Conflict resolution (prefer newer data)

**Key Functions:**
```typescript
updateEntry(date, content)     // Update a day's entry
syncToDatabase()                // Manual sync
loadFromDatabase()              // Fetch latest from DB
```

---

### **2. API Client: `client/src/lib/journalAPI.ts`**

**Endpoints Used:**
```typescript
// Save snapshots
POST /api/matrix/plan
POST /api/matrix/reality

// Get latest data
GET /api/matrix/{userId}/{year}/daily

// Get all snapshots (for Time Machine)
GET /api/matrix/{userId}/{year}/plans
GET /api/matrix/{userId}/{year}/realities

// Time Machine
GET /api/timemachine/{userId}/{year}/timeline
GET /api/timemachine/{userId}/{year}/snapshot/{timestamp}
```

**Current User ID:** `'default-user'` (hardcoded in journalAPI.ts:16)

---

## 🐛 The Bug You Encountered

### **Error:**
```
Key (user_id)=(default-user) is not present in table "users".
```

### **Root Cause:**
1. Frontend sends `user_id: 'default-user'`
2. PostgreSQL enforces foreign key constraints
3. No user with ID 'default-user' exists in database
4. Insert fails with FK violation

### **The Fix:**
Run this command to create the default user:

```bash
npm run db:setup
```

This creates a user with:
- `id`: 'default-user'
- `username`: 'default'
- `password`: 'no-password-needed'

---

## ✅ Correct Setup Steps

**On your Mac (local development):**

```bash
# 1. Make sure .env file exists with DATABASE_URL
cat .env

# 2. Push schema to Neon (create tables)
npm run db:push

# 3. Create default user
npm run db:setup

# 4. Start dev server
npm run dev

# 5. Open http://localhost:5001
```

**Expected output when saving:**
```
💾 Saved 365 plan entries to localStorage for 2025
🔄 Auto-saving plan to database...
✅ Auto-saved plan to database successfully
```

---

## 🎯 Summary

### **Your 365-Day Structure:**

- ✅ **PLAN Matrix:** 365 columns (day_001 to day_365) for yearly planning
- ✅ **REALITY Matrix:** 365 columns (day_001 to day_365) for what actually happened
- ✅ **Daily Snapshots:** JSONB field storing latest state of all 365 days
- ✅ **Weekly Data:** Added support for week_001 to week_053 (52-53 weeks per year)
- ✅ **Time Machine:** Full version history of all changes

### **Data Storage:**
- **Local:** Browser localStorage (offline-first)
- **Cloud:** Neon PostgreSQL (multi-device sync)
- **Auto-sync:** 2-second debounced saves

### **Next Steps:**
1. Run `npm run db:setup` to create default user
2. Test saving journal entries
3. Verify data appears in Neon database
4. Deploy to Render.com when ready

---

## 🔧 Useful Commands

```bash
# Test database connection
npm run db:test

# Create tables
npm run db:push

# Create default user (FIX FOR YOUR ERROR!)
npm run db:setup

# Visual database editor
npm run db:studio

# Start dev server
npm run dev
```
