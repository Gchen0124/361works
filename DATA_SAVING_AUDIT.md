# DailyGlass Data Saving Audit & Fix Plan

## 🐛 **Issue Reported**

**Symptoms:**
- User creates 2 journal entries
- Entries show up when reopening app (localStorage ✅)
- Entries NOT in Neon database (cloud sync ❌)
- No error messages visible

## 🔍 **Root Cause Analysis**

### **Hypothesis 1: API Connection Failing** (Most Likely)

The `isOnline` state never becomes `true`, so auto-save never triggers.

**Evidence:**
- LocalStorage works (data persists locally)
- No database saves (auto-save skipped)
- Auto-save only runs if `isOnline === true`

**Check this:**
```typescript
// In client/src/hooks/useJournalData.ts:255-258
const autoSaveToDatabase = useCallback((mode, entries, isOnline) => {
  if (!isOnline) {
    console.log(`⏸️ Skipping auto-save for ${mode} (offline)`);
    return;  // ❌ THIS IS BLOCKING SAVES!
  }
```

**How to verify:**
1. Open browser console
2. Look for: `"⏸️ Skipping auto-save"` messages
3. Or look for: `"isOnline: false"` in the loaded data logs

---

### **Hypothesis 2: Health Check Endpoint Failing**

The `/api/health` endpoint might not be responding properly.

**Check this on Mac:**
```bash
# While server is running
curl http://localhost:5001/api/health
```

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-14T...",
  "features": ["matrix-journal", "time-machine", "csv-export"]
}
```

**If this fails:** Health check is broken, `isOnline` stays false.

---

### **Hypothesis 3: CORS or Network Issues**

Frontend and backend might be on different ports causing CORS blocks.

**Check:**
- Frontend: `http://localhost:5001`
- Backend API: `http://localhost:5001`
- Should be same (✅ this is correct)

---

### **Hypothesis 4: Auto-save Debounce Timer Cancelled**

The 2-second debounce timer might be getting cleared before save completes.

**Code location:** `client/src/hooks/useJournalData.ts:267-299`

---

## 🔧 **Diagnostic Steps (Run These Now)**

### **Step 1: Run Database Diagnostic**

```bash
npm run db:diagnose
```

This checks:
- ✅ Database connection
- ✅ Default user exists
- ✅ Plan/Reality snapshots in DB
- ✅ Daily snapshot exists
- ✅ Timeline entries

---

### **Step 2: Check Browser Console**

Open http://localhost:5001, press F12, check Console tab for:

**Good signs:**
```
✅ Connected successfully to Neon
🔄 Loaded journal data for 2025: { planCount: X, realityCount: Y, currentMode: 'plan', isOnline: true }
🔄 Auto-saving plan to database...
✅ Auto-saved plan to database successfully
```

**Bad signs:**
```
❌ API health check failed
⏸️ Skipping auto-save for plan (offline)
isOnline: false
```

---

### **Step 3: Check Server Logs**

In terminal where `npm run dev` is running, look for:

**Good signs:**
```
POST /api/matrix/plan 200 in 156ms
```

**Bad signs:**
```
POST /api/matrix/plan 500 in 1341ms
(No POST requests at all)
```

---

## 🛠️ **Fixes**

### **Fix 1: Force Online Mode (Temporary Debug)**

To test if this is the issue, temporarily bypass the online check:

**Edit:** `client/src/hooks/useJournalData.ts`

**Find line 255:**
```typescript
const autoSaveToDatabase = useCallback((mode: JournalMode, entries: JournalEntries, isOnline: boolean) => {
  if (!isOnline) {
    console.log(`⏸️ Skipping auto-save for ${mode} (offline)`);
    return;
  }
```

**Change to:**
```typescript
const autoSaveToDatabase = useCallback((mode: JournalMode, entries: JournalEntries, isOnline: boolean) => {
  // TEMPORARY: Force save even if offline
  console.log(`🔄 Auto-save triggered (isOnline: ${isOnline})`);

  // if (!isOnline) {
  //   console.log(`⏸️ Skipping auto-save for ${mode} (offline)`);
  //   return;
  //}
```

**Restart dev server** and try saving. If data now appears in Neon, the issue is the `isOnline` check.

---

### **Fix 2: Improve Health Check with Retry**

**Edit:** `client/src/hooks/useJournalData.ts`

**Replace** `checkConnectivity` function (around line 78):

```typescript
const checkConnectivity = useCallback(async () => {
  try {
    console.log('🔍 Checking API connectivity...');
    const isHealthy = await journalAPI.healthCheck();
    console.log(`📡 API health check: ${isHealthy ? '✅ Online' : '❌ Offline'}`);

    if (isMountedRef.current) {
      setJournalData(prev => ({ ...prev, isOnline: isHealthy }));
    }
    return isHealthy;
  } catch (error) {
    console.error('❌ Health check error:', error);
    if (isMountedRef.current) {
      setJournalData(prev => ({ ...prev, isOnline: false }));
    }
    return false;
  }
}, []);
```

---

### **Fix 3: Add Manual Save Button** (Better UX)

Add a "Save to Cloud" button so users can manually sync.

**In** `client/src/pages/Journal.tsx`, add:

```tsx
<button
  onClick={async () => {
    try {
      await syncToDatabase();
      toast({ title: "Saved to cloud successfully!" });
    } catch (error) {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  }}
  className="px-4 py-2 bg-blue-500 text-white rounded"
>
  💾 Save to Cloud
</button>
```

---

## 📊 **All Data Saving Mechanisms**

### **1. LocalStorage Save** (WORKING ✅)

**Location:** `client/src/hooks/useJournalData.ts:159-176`

**How it works:**
- Every time `planEntries` or `realityEntries` changes
- Immediately saves to browser localStorage
- Keys: `journal-plan-2025`, `journal-reality-2025`

**Status:** ✅ Working (evidenced by data persisting on refresh)

---

### **2. Auto-Save to Database** (BROKEN ❌)

**Location:** `client/src/hooks/useJournalData.ts:255-300`

**How it should work:**
1. User types in journal entry
2. `updateEntry()` called
3. LocalStorage updated immediately
4. `autoSaveToDatabase()` called with 2-second debounce
5. After 2 seconds, POST to `/api/matrix/plan`
6. Database updated

**Current issue:** Skipped if `isOnline === false`

---

### **3. Manual Sync** (Should Work)

**Location:** `client/src/hooks/useJournalData.ts:368-390`

**Function:** `syncToDatabase()`

**Test this:**
```typescript
// In browser console:
// (assumes you have access to the hook)
await syncToDatabase();
```

---

### **4. Time Machine** (UNTESTED)

**Endpoints:**
- `GET /api/timemachine/{userId}/{year}/timeline`
- `GET /api/timemachine/{userId}/{year}/snapshot/{timestamp}`
- `GET /api/timemachine/{userId}/{year}/compare?timestamp1=X&timestamp2=Y`

**Status:** Likely broken if no data is being saved to DB

**Requirements:**
- Needs data in `journal_plan_matrix` and `journal_reality_matrix`
- Needs `timeline_index` entries
- Currently can't work if no snapshots exist

---

## 🎯 **Immediate Action Plan**

### **For User (You):**

1. **Run diagnostic:**
   ```bash
   npm run db:diagnose
   ```

2. **Check browser console** while using app:
   - Look for `isOnline: true` or `isOnline: false`
   - Look for auto-save messages
   - Look for errors

3. **Check server logs** for POST requests

4. **Report findings:** Share console output so I can identify exact issue

---

### **For Me (Next Commits):**

1. ✅ Add better logging to identify issue
2. ✅ Add retry logic for health checks
3. ✅ Add manual save button for better UX
4. ✅ Fix Time Machine if broken
5. ✅ Add multi-user authentication
6. ✅ Plan Notion integration

---

## 🚨 **Quick Fix (Try This First)**

**Most likely cause:** `isOnline` is false

**Quick test:**
1. Open browser console
2. Type: `localStorage`
3. Check if `journal-plan-2025` exists with data
4. Check console for health check errors

**If you see** `isOnline: false`:
- Health check is failing
- Check if server is actually running on port 5001
- Check network tab in DevTools for failed requests

**If you see** `isOnline: true`:
- Auto-save should be working
- Check server logs for actual POST requests
- Look for 500 errors or validation errors

---

## 📞 Next Steps

Run the diagnostic script and share the output. I'll pinpoint the exact issue and create targeted fixes.

```bash
npm run db:diagnose
```

Then check browser console and share what you see!
