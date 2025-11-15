# DailyGlass Implementation Roadmap

## 🎯 **Priority Order & Justification**

Based on your requirements, here's the prioritized plan:

**Priority 1:** Fix Current Data Saving Issues (CRITICAL)
**Priority 2:** Multi-User Authentication (FOUNDATION)
**Priority 3:** Enhance Time Machine Feature (CORE VALUE)
**Priority 4:** Notion MCP Integration - Daily Items Sync (POWER FEATURE)
**Priority 5:** Notion Time Machine Integration (ADVANCED FEATURE)

---

## 📋 **PRIORITY 1: Fix Data Saving to Neon** ⚡ (CRITICAL - DO FIRST)

**Status:** 🔴 BLOCKING - Must fix before anything else
**Time Estimate:** 2-4 hours
**Dependencies:** None

### **Why First:**
Nothing else matters if data doesn't save. This is fundamental.

### **Tasks:**

#### 1.1 Diagnose Current Issue
- [x] Create diagnostic script (`npm run db:diagnose`)
- [ ] User runs diagnostic and shares output
- [ ] Identify if `isOnline` is false or API is failing
- [ ] Check health endpoint accessibility

#### 1.2 Fix Root Cause
**If `isOnline` is false:**
- [ ] Add retry logic to health check
- [ ] Add better error logging
- [ ] Consider fallback: auto-save even if health check fails

**If API is failing:**
- [ ] Fix CORS if needed
- [ ] Fix endpoint routing
- [ ] Add request/response logging

#### 1.3 Add Better UX
- [ ] Add "Save to Cloud" manual button
- [ ] Show sync status indicator (online/offline/syncing)
- [ ] Add toast notifications for save success/failure
- [ ] Show last sync timestamp

#### 1.4 Test & Verify
- [ ] Create entry → verify in Neon
- [ ] Test offline → online transition
- [ ] Test rapid saves (debounce working?)
- [ ] Test page refresh (data persists?)

**Deliverables:**
- ✅ Data saves reliably to Neon
- ✅ User sees sync status
- ✅ Manual save button as fallback

---

## 📋 **PRIORITY 2: Multi-User Authentication** 👥 (FOUNDATION)

**Status:** 🟡 HIGH PRIORITY
**Time Estimate:** 1-2 weeks
**Dependencies:** Priority 1 complete

### **Why Second:**
Authentication is the foundation for:
- Multiple users sharing one deployment
- Personal data privacy
- Notion integration (user-specific API keys)
- Production readiness

### **Current State:**
- Single hardcoded user: `'default-user'`
- No login/logout
- No password hashing
- No sessions

### **Implementation Plan:**

#### 2.1 Database Schema Updates
```sql
-- Users table already exists, add:
ALTER TABLE users ADD COLUMN email VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN hashed_password TEXT;  -- bcrypt
ALTER TABLE users ADD COLUMN notion_api_key TEXT ENCRYPTED;  -- for integration
ALTER TABLE users ADD COLUMN created_at TIMESTAMP;
ALTER TABLE users ADD COLUMN last_login TIMESTAMP;
```

#### 2.2 Backend: Auth System
**Tech Stack:** Passport.js (already in dependencies!) + JWT

**Files to create:**
- `server/auth/passport-config.ts` - Passport strategy
- `server/auth/jwt.ts` - Token generation/verification
- `server/middleware/auth.ts` - Protect routes
- `server/routes/auth.ts` - Login/signup/logout endpoints

**Endpoints:**
```typescript
POST /api/auth/signup        // Create account
POST /api/auth/login         // Login (returns JWT)
POST /api/auth/logout        // Logout
GET  /api/auth/me            // Get current user
POST /api/auth/refresh-token // Refresh JWT
```

#### 2.3 Frontend: Auth UI
**Files to create:**
- `client/src/pages/Login.tsx`
- `client/src/pages/Signup.tsx`
- `client/src/contexts/AuthContext.tsx`
- `client/src/hooks/useAuth.ts`

**Features:**
- Email/password login
- Session persistence (JWT in httpOnly cookie)
- Protected routes (redirect to login if not authed)
- User profile page

#### 2.4 Update API Client
**Changes to `client/src/lib/journalAPI.ts`:**
```typescript
class JournalAPI {
  private userId: string = 'default-user';  // ❌ Remove hardcode

  // ✅ Add dynamic user ID from auth context
  private getUserId(): string {
    const token = this.getToken();
    const decoded = jwt.decode(token);
    return decoded.userId;
  }

  private getToken(): string {
    return localStorage.getItem('auth_token') || '';
  }

  // Add token to all requests
  async apiRequest(method, url, body) {
    return fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getToken()}`  // ✅ Add auth
      },
      body: JSON.stringify(body)
    });
  }
}
```

#### 2.5 Protect All Routes
```typescript
// server/routes.ts
import { requireAuth } from './middleware/auth';

app.post("/api/matrix/plan", requireAuth, async (req, res) => {
  const userId = req.user.id;  // ✅ From JWT, not hardcoded
  // ...
});
```

#### 2.6 Migration Plan
**For existing data:**
```typescript
// Migration script: migrate-to-multi-user.ts
// 1. All data currently under 'default-user'
// 2. First signup gets ownership of existing data
// 3. OR: prompt on first login "Claim this data?"
```

**Deliverables:**
- ✅ User signup/login/logout
- ✅ JWT-based authentication
- ✅ Protected API routes
- ✅ Each user sees only their data
- ✅ Existing data migrated to first user

---

## 📋 **PRIORITY 3: Enhanced Time Machine** ⏰ (CORE VALUE)

**Status:** 🟢 MEDIUM PRIORITY
**Time Estimate:** 1 week
**Dependencies:** Priority 1, 2 complete

### **Why Third:**
Time Machine is a unique feature that sets your app apart. It needs to work perfectly with the database.

### **Current State:**
- Schema exists (`timeline_index` table)
- API endpoints exist but untested
- Frontend hooks exist but might be broken
- No UI for time travel

### **Implementation Plan:**

#### 3.1 Test & Fix Existing Time Machine APIs

**Endpoints to test:**
```typescript
GET /api/timemachine/{userId}/{year}/timeline
GET /api/timemachine/{userId}/{year}/snapshot/{timestamp}
GET /api/timemachine/{userId}/{year}/compare?timestamp1=X&timestamp2=Y
```

**Test script:** `scripts/test-time-machine.ts`

#### 3.2 Create Time Machine UI

**New component:** `client/src/components/TimeMachine.tsx`

**Features:**
- Timeline scrubber (visual timeline of all changes)
- Date picker to jump to specific date
- "Before/After" view (split screen)
- Diff highlighting (show what changed)

**UI Mockup:**
```
┌─────────────────────────────────────────────────────┐
│  Time Machine                              [Close X]│
├─────────────────────────────────────────────────────┤
│                                                      │
│  Timeline:                                          │
│  ●─────●──────●───────●──────●─────●  [Today]       │
│  Jan 1  Jan 5  Jan 10  Jan 15 Jan 20 Jan 25        │
│        ▲                                            │
│    You are here                                     │
│                                                      │
│  ┌────────────────┐  ┌────────────────┐            │
│  │  JAN 10, 2025  │  │  JAN 11, 2025  │            │
│  │  (Before)      │  │  (After)       │            │
│  ├────────────────┤  ├────────────────┤            │
│  │                │  │                │            │
│  │  Plan entry    │  │  Plan entry    │            │
│  │  [no changes]  │  │  [modified] ✓  │            │
│  │                │  │  +Added text   │            │
│  │                │  │  -Removed text │            │
│  └────────────────┘  └────────────────┘            │
│                                                      │
│  [◀ Previous] [Restore this version] [Next ▶]      │
└─────────────────────────────────────────────────────┘
```

#### 3.3 Add Comparison Feature

**New feature:** Compare any two dates

```typescript
// API call
const comparison = await journalAPI.compareTimeMachineSnapshots(
  year,
  '2025-01-10T10:00:00Z',
  '2025-01-15T15:30:00Z'
);

// Response:
{
  timestamp1: '2025-01-10T10:00:00Z',
  timestamp2: '2025-01-15T15:30:00Z',
  plan_diff: [
    { day: 'day_010', before: 'old', after: 'new', status: 'modified' },
    { day: 'day_011', before: null, after: 'added', status: 'added' },
  ],
  reality_diff: [...]
}
```

#### 3.4 Optimize Storage
**Issue:** Each save creates a full 365-day snapshot (wasteful)

**Solution:** Delta compression
```typescript
// Instead of storing full 365 days each time:
{
  snapshot_timestamp: '2025-01-10T10:00:00Z',
  day_001: 'Full text...',
  day_002: 'Full text...',
  // ... 363 more
}

// Store deltas:
{
  snapshot_timestamp: '2025-01-10T10:00:00Z',
  parent_snapshot_id: 123,  // Previous snapshot
  changed_days: {
    day_010: 'New text',     // Only changed days
    day_015: 'Updated'
  }
}

// Reconstruct on read by merging deltas
```

**Deliverables:**
- ✅ Visual timeline UI
- ✅ Before/After comparison view
- ✅ Diff highlighting
- ✅ Restore previous versions
- ✅ Optimized storage (delta compression)

---

## 📋 **PRIORITY 4: Notion Integration - Daily Items Sync** 🔗 (POWER FEATURE)

**Status:** 🟢 MEDIUM PRIORITY
**Time Estimate:** 2-3 weeks
**Dependencies:** Priority 1, 2, 3 complete

### **Why Fourth:**
Notion integration is powerful but complex. Needs solid auth foundation first.

### **Your Vision:**
> "We have daily items in Notion DB (one day as a page with lots of properties). Each day will have its reality property and plan property. At different times we would enter the reality and refresh them in our system."

### **Architecture Design:**

#### 4.1 Notion Database Structure

**Notion Database:** "Daily Journal 2025"

**Properties:**
- `Date` (Date) - Page title
- `Plan` (Rich Text) - What you plan to do
- `Reality` (Rich Text) - What actually happened
- `Mood` (Select) - Emotion for the day
- `Tags` (Multi-select) - Categories
- `Completion Rate` (Number) - % of plan completed
- `Created Time` (Created time)
- `Last Edited` (Last edited time)

**Page structure:**
```
📅 January 1, 2025
├── Plan: "Work on project X, Exercise"
├── Reality: "Worked on project X only"
├── Mood: 😊 Good
├── Tags: [Work, Health]
└── Completion Rate: 50%
```

#### 4.2 Sync Strategy: Bidirectional

**DailyGlass → Notion:**
- When user saves in DailyGlass
- Create/update corresponding Notion page
- Use Notion API to update `Plan` and `Reality` properties

**Notion → DailyGlass:**
- Webhook from Notion (when user edits in Notion)
- OR: Periodic polling (every 5 min)
- Sync changes back to DailyGlass database

#### 4.3 Implementation

**Backend: Notion MCP Integration**

**Install Notion MCP:**
```bash
npm install @modelcontextprotocol/server-notion
```

**Files to create:**
- `server/integrations/notion-client.ts`
- `server/integrations/notion-sync.ts`
- `server/routes/notion.ts`

**Notion API endpoints:**
```typescript
// Setup
POST /api/notion/connect      // Save user's Notion API key & database ID
GET  /api/notion/databases     // List user's Notion databases
POST /api/notion/select-db     // Choose which DB to sync

// Sync operations
POST /api/notion/sync-to-notion      // Push DailyGlass → Notion
POST /api/notion/sync-from-notion    // Pull Notion → DailyGlass
POST /api/notion/sync-bidirectional  // Two-way sync

// Webhooks
POST /api/notion/webhook       // Receive Notion page updates
```

**Sync logic:**
```typescript
class NotionSync {
  async syncDayToNotion(userId: string, date: Date, planContent: string, realityContent: string) {
    // 1. Check if Notion page exists for this date
    const existingPage = await this.findNotionPage(userId, date);

    if (existingPage) {
      // 2. Update existing page
      await this.notionClient.pages.update({
        page_id: existingPage.id,
        properties: {
          Plan: { rich_text: [{ text: { content: planContent } }] },
          Reality: { rich_text: [{ text: { content: realityContent } }] },
          'Last Synced': { date: { start: new Date().toISOString() } }
        }
      });
    } else {
      // 3. Create new page
      await this.notionClient.pages.create({
        parent: { database_id: user.notion_database_id },
        properties: {
          Date: { title: [{ text: { content: formatDate(date) } }] },
          Plan: { rich_text: [{ text: { content: planContent } }] },
          Reality: { rich_text: [{ text: { content: realityContent } }] },
        }
      });
    }
  }

  async syncFromNotion(userId: string, year: number) {
    // 1. Query Notion database for all pages in year
    const pages = await this.notionClient.databases.query({
      database_id: user.notion_database_id,
      filter: {
        and: [
          { property: 'Date', date: { on_or_after: `${year}-01-01` } },
          { property: 'Date', date: { on_or_before: `${year}-12-31` } }
        ]
      }
    });

    // 2. Convert to DailyGlass format
    const updates = pages.results.map(page => ({
      date: page.properties.Date.date.start,
      plan: page.properties.Plan.rich_text[0]?.text.content || '',
      reality: page.properties.Reality.rich_text[0]?.text.content || ''
    }));

    // 3. Update DailyGlass database
    await this.saveToDatabase(userId, year, updates);
  }
}
```

#### 4.4 Frontend: Notion Settings UI

**New page:** `client/src/pages/NotionSettings.tsx`

```tsx
function NotionSettings() {
  return (
    <div>
      <h1>Notion Integration</h1>

      {/* Step 1: Connect Notion */}
      <section>
        <h2>1. Connect Your Notion Account</h2>
        <input
          type="text"
          placeholder="Notion API Key (secret_...)"
          onChange={(e) => setApiKey(e.target.value)}
        />
        <button onClick={connectNotion}>Connect</button>
      </section>

      {/* Step 2: Select Database */}
      <section>
        <h2>2. Select Daily Journal Database</h2>
        <select onChange={(e) => selectDatabase(e.target.value)}>
          {databases.map(db => (
            <option key={db.id} value={db.id}>{db.title}</option>
          ))}
        </select>
      </section>

      {/* Step 3: Sync Options */}
      <section>
        <h2>3. Sync Settings</h2>
        <label>
          <input type="checkbox" checked={autoSync} onChange={toggleAutoSync} />
          Auto-sync every 5 minutes
        </label>

        <button onClick={syncNow}>Sync Now</button>
      </section>

      {/* Sync Status */}
      <section>
        <h3>Last synced: {lastSyncTime}</h3>
        <h3>Synced entries: {syncedCount}/365</h3>
      </section>
    </div>
  );
}
```

#### 4.5 Conflict Resolution

**Scenario:** User edits same day in both DailyGlass and Notion

**Strategy: Last Write Wins (with timestamp comparison)**

```typescript
async function resolveConflict(dailyGlassEntry, notionEntry) {
  const dgTimestamp = dailyGlassEntry.updated_at;
  const notionTimestamp = notionEntry.last_edited_time;

  if (dgTimestamp > notionTimestamp) {
    // DailyGlass is newer → sync to Notion
    await syncToNotion(dailyGlassEntry);
    return 'dailyglass-wins';
  } else {
    // Notion is newer → sync from Notion
    await syncFromNotion(notionEntry);
    return 'notion-wins';
  }
}
```

**Alternative: Manual conflict resolution UI**
```
┌──────────────────────────────────────┐
│  Conflict Detected!                   │
├──────────────────────────────────────┤
│  You edited Jan 10 in both places:   │
│                                       │
│  DailyGlass (edited 2:30 PM):        │
│  "Worked on project X"               │
│                                       │
│  Notion (edited 3:00 PM):            │
│  "Worked on project X and Y"         │
│                                       │
│  Which version do you want to keep?  │
│  [ Keep DailyGlass ] [ Keep Notion ] │
│  [ Merge Both ]                       │
└──────────────────────────────────────┘
```

**Deliverables:**
- ✅ Connect Notion account
- ✅ Select Notion database
- ✅ Bi-directional sync (DailyGlass ↔ Notion)
- ✅ Auto-sync every 5 minutes
- ✅ Manual "Sync Now" button
- ✅ Conflict resolution (last-write-wins or manual)
- ✅ Sync status indicator

---

## 📋 **PRIORITY 5: Notion Time Machine Integration** 🕰️🔗 (ADVANCED)

**Status:** 🔵 LOW PRIORITY (Nice-to-have)
**Time Estimate:** 1-2 weeks
**Dependencies:** All above complete

### **Why Last:**
This is complex and builds on everything else. Most users won't need this immediately.

### **Your Question:**
> "Do you think we can also have that database a time machine feature integrated with Notion?"

**Answer:** **Yes, but with limitations.**

### **Challenges:**

1. **Notion doesn't expose version history via API**
   - Notion has page history (internally)
   - But API doesn't give access to old versions
   - We can't fetch "what this page looked like on Jan 10"

2. **Workaround: Store our own Notion snapshot history**
   - Every time we sync from Notion, store a snapshot
   - This gives us Notion history in *our* database
   - Not true Notion history, but history of synced data

### **Implementation:**

#### 5.1 Architecture

**New table:** `notion_sync_history`

```sql
CREATE TABLE notion_sync_history (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) REFERENCES users(id),
  sync_timestamp TIMESTAMP NOT NULL,
  year INTEGER NOT NULL,
  notion_page_id TEXT NOT NULL,
  date DATE NOT NULL,
  plan_content TEXT,
  reality_content TEXT,
  notion_last_edited TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notion_sync_user_date ON notion_sync_history(user_id, date);
CREATE INDEX idx_notion_sync_timestamp ON notion_sync_history(sync_timestamp);
```

**How it works:**
```
Every 5 minutes (auto-sync):
1. Fetch Notion pages
2. Store snapshot in notion_sync_history
3. Also update main DailyGlass database

Result:
- We have history of what Notion looked like every 5 minutes
- Can show "Notion Timeline" alongside DailyGlass timeline
- Can compare: "What did I write in Notion vs DailyGlass at 2 PM?"
```

#### 5.2 Unified Time Machine UI

**New view:** Show both DailyGlass and Notion timelines side-by-side

```
┌─────────────────────────────────────────────────────────────┐
│  Unified Time Machine                                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  DailyGlass Timeline:                                       │
│  ●────●────●────●────●────●  [Now]                          │
│  10am  11am  12pm  1pm  2pm  3pm                           │
│                    ▲                                         │
│                                                              │
│  Notion Sync Timeline:                                      │
│  ○─────○─────○─────○─────○  [Now]                          │
│  10:05  11:05  12:05  1:05  2:05                           │
│                         ▲                                    │
│                                                              │
│  ┌────────────────────┐  ┌────────────────────┐            │
│  │  DailyGlass @ 1PM  │  │  Notion @ 1:05 PM  │            │
│  ├────────────────────┤  ├────────────────────┤            │
│  │  "Worked on X"     │  │  "Worked on X & Y" │            │
│  │                    │  │  (edited in Notion)│            │
│  └────────────────────┘  └────────────────────┘            │
│                                                              │
│  Difference: +Added "& Y" in Notion 5 min later             │
└─────────────────────────────────────────────────────────────┘
```

#### 5.3 Practical Use Cases

**Use Case 1: "When did I update this in Notion?"**
- User: "I know I edited Jan 10 in Notion around 2 PM"
- Time Machine: Shows Notion sync at 2:05 PM with changes
- Can see exactly what was added/removed

**Use Case 2: "What's the difference between my Notion and DailyGlass entries?"**
- Shows side-by-side comparison
- Highlights conflicts (if edited in both places)
- Offers merge options

**Use Case 3: "Restore from Notion backup"**
- If user accidentally deletes in DailyGlass
- Can restore from Notion sync history
- "Restore from Notion snapshot at 2:05 PM"

**Deliverables:**
- ✅ Notion sync history stored in database
- ✅ Unified timeline showing both DailyGlass and Notion edits
- ✅ Side-by-side comparison view
- ✅ Restore from Notion snapshot feature

---

## 🗓️ **Timeline Overview**

| Priority | Feature | Time | Status |
|----------|---------|------|--------|
| **1** | Fix Data Saving | 2-4 hours | 🔴 CRITICAL |
| **2** | Multi-User Auth | 1-2 weeks | 🟡 HIGH |
| **3** | Time Machine | 1 week | 🟢 MEDIUM |
| **4** | Notion Integration | 2-3 weeks | 🟢 MEDIUM |
| **5** | Notion Time Machine | 1-2 weeks | 🔵 LOW |

**Total:** ~6-9 weeks for full implementation

---

## 🎯 **Recommended Approach**

### **Phase 1: Foundation (Week 1-2)**
1. Fix data saving (Priority 1) - CRITICAL
2. Start multi-user auth (Priority 2)

### **Phase 2: Core Features (Week 3-4)**
3. Complete multi-user auth
4. Enhance Time Machine (Priority 3)

### **Phase 3: Integration (Week 5-7)**
5. Notion integration (Priority 4)
6. Test & polish

### **Phase 4: Advanced (Week 8-9 - Optional)**
7. Notion Time Machine (Priority 5)
8. Additional features as needed

---

## 🚀 **Next Immediate Steps**

**For you to do NOW:**

1. Run diagnostic:
   ```bash
   npm run db:diagnose
   ```

2. Check browser console while using app:
   - Open DevTools (F12)
   - Go to Console tab
   - Look for `isOnline: true` or `isOnline: false`
   - Look for error messages

3. Try creating an entry and watch:
   - Console logs
   - Server terminal logs
   - Check Neon database after

4. Report findings so I can create targeted fix

**For me to do:**
- Wait for your diagnostic results
- Create precise fix based on findings
- Commit and push fixes
- Move to Priority 2 (Auth) once Priority 1 is solid

---

## 💡 **Key Insights**

### **On Notion Integration:**
- ✅ Doable and valuable
- ⚠️ Requires solid auth first (API keys per user)
- ⚠️ Notion API limitations (no native version history)
- ✅ Workaround: Store our own sync history

### **On Multi-User:**
- ✅ Neon PostgreSQL fully supports multi-tenancy
- ✅ Just need proper auth + row-level filtering
- ✅ Current schema already has user_id foreign keys
- ✅ Easy to add auth with Passport.js (already installed!)

### **On Time Machine:**
- ✅ Core feature - differentiate from competitors
- ⚠️ Storage intensive (365 days × many snapshots)
- ✅ Solution: Delta compression
- ✅ Can integrate with Notion sync history

---

## 📞 **Questions Before We Proceed?**

1. Does this priority order make sense to you?
2. Should we start with auth or fix data saving first? (I recommend data saving)
3. For Notion: Do you already have a Notion database set up?
4. Timeline realistic? Any deadlines?

**Let me know your diagnostic results and we'll get started!** 🚀
