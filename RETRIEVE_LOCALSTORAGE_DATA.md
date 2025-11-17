# 📦 How to Retrieve Your Important Browser Data

Your daily journal data is stored in your browser's **localStorage**. This guide will help you retrieve it and migrate it to Neon.

## 🔍 Where is Your Data?

Based on the code audit, your journal data is stored in **localStorage** with these keys:

### Storage Keys Pattern:
```
journal-plan-2025          → Your plan entries for 2025
journal-reality-2025       → Your reality entries for 2025
journal-plan-2024          → Your plan entries for 2024 (if exists)
journal-reality-2024       → Your reality entries for 2024 (if exists)
journal-current-mode       → Current mode (plan/reality)
journal-last-sync-2025     → Last sync timestamp
```

### Data Format:
The data is stored as JSON objects with keys like:
- **Old format:** `"2025-01-15": "content"` (date-based keys)
- **New format:** `"day_015": "content"` (day number keys)

Both formats are supported and will be automatically migrated!

---

## 🚀 Method 1: Quick Export (Recommended)

### Step 1: Run Development Server
```bash
npm run dev
```

### Step 2: Open Export Page in Browser

Navigate to:
```
http://localhost:5000/export-localStorage.html
```

Or visit the **same domain where you've been using the journal app** (important!)

### Step 3: Export Your Data

Click the **"📥 Export All Data as JSON"** button

This will download a file like: `journal-backup-2025-01-17.json`

### What You'll See:
```
✅ Found journal data!
📅 Plan data for years: 2025
📊 Total plan days: 45
📅 Reality data for years: 2025
📊 Total reality days: 32
```

---

## 🔧 Method 2: Browser Console (Manual)

If the export page doesn't work, use browser DevTools:

### Step 1: Open DevTools
- Press `F12` or `Right-click → Inspect`
- Go to **Console** tab

### Step 2: Run Export Script

Paste this into the console:

```javascript
// Export all journal data
const exportData = {
  timestamp: new Date().toISOString(),
  source: 'localStorage',
  data: {}
};

// Scan localStorage for journal keys
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (key && key.startsWith('journal-')) {
    exportData.data[key] = localStorage.getItem(key);
  }
}

// Download as JSON file
const dataStr = JSON.stringify(exportData, null, 2);
const dataBlob = new Blob([dataStr], { type: 'application/json' });
const url = URL.createObjectURL(dataBlob);
const link = document.createElement('a');
link.href = url;
link.download = `journal-backup-${new Date().toISOString().split('T')[0]}.json`;
link.click();
URL.revokeObjectURL(url);

console.log('✅ Export complete! Check your Downloads folder.');
console.log('Data preview:', exportData);
```

### Step 3: Check Downloads

You'll find a file like `journal-backup-2025-01-17.json` in your Downloads folder.

---

## 📂 Method 3: Browser DevTools Storage Tab

### Step 1: Open DevTools Storage
1. Press `F12`
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Expand **Local Storage** in the left sidebar
4. Click on your domain (e.g., `http://localhost:5000`)

### Step 2: View Your Data

You'll see all keys starting with `journal-`:
- `journal-plan-2025`
- `journal-reality-2025`
- etc.

### Step 3: Manual Copy

For each key:
1. Click on the key
2. Copy the **Value** column
3. Save to a text file

---

## 🔄 Migrate Data to Neon

Once you have your `journal-backup.json` file:

### Step 1: Save Backup File

Save your exported JSON file as:
```
/home/user/361works/localStorage-backup.json
```

### Step 2: Make Sure DATABASE_URL is Set

Check your `.env` file has:
```bash
DATABASE_URL=postgresql://your-neon-connection-string
```

### Step 3: Run Migration Script

```bash
npm run migrate-local-data
```

### Expected Output:
```
🚀 Starting localStorage to Neon migration...
✅ Database connected
✅ Default user found
📂 Loaded backup from: 2025-01-17T10:30:00Z

📅 Found plan data for 2025: 45 days
📅 Found reality data for 2025: 32 days

🔄 Migrating 1 year(s) to Neon...

📤 Uploading 2025 data to Neon...
   Plan days: 45
   Reality days: 32
   ✅ Plan data uploaded
   ✅ Reality data uploaded
   ✅ Year 2025 migration complete!

🎉 Migration completed!
```

### Step 4: Verify in App

1. Open your app: `http://localhost:5000`
2. Open browser console (F12)
3. Look for: `✅ Loaded from database: 45 plan, 32 reality entries`
4. Your data should now appear!

### Step 5: Verify in Neon

Visit https://console.neon.tech
- Go to **Tables** → `journal_plan_matrix`
- You should see your migrated data

---

## 📊 Example Export File Structure

Your `journal-backup.json` will look like this:

```json
{
  "timestamp": "2025-01-17T10:30:00.000Z",
  "source": "localStorage",
  "data": {
    "journal-plan-2025": "{\"day_001\":\"Plan for day 1\",\"day_002\":\"Plan for day 2\"}",
    "journal-reality-2025": "{\"day_001\":\"Reality day 1\",\"day_002\":\"Reality day 2\"}",
    "journal-current-mode": "plan",
    "journal-last-sync-2025": "2025-01-15T08:00:00.000Z"
  }
}
```

---

## ⚠️ Important Notes

### 1. **Use the Same Browser/Domain**

localStorage is **domain-specific**. You must:
- Use the **same browser** where you entered the data
- Access the **same domain** (e.g., `localhost:5000` or your deployed URL)
- If you used multiple domains, export from each one

### 2. **Data is Browser-Specific**

If you used the journal on multiple devices/browsers:
- Export from **each browser** separately
- Merge the JSON files or run migration multiple times
- The migration script will merge data automatically

### 3. **localStorage Can Be Cleared**

If you:
- Cleared browser cache
- Used incognito/private mode (data lost on close)
- Switched browsers

Your data may be lost. **Export immediately** to prevent data loss!

### 4. **Weekly Data**

The app stores **daily** data, not separate weekly summaries. Weekly views are calculated from daily entries. All 365 days are preserved.

---

## 🔍 Troubleshooting

### Issue: "No journal data found"

**Causes:**
1. Wrong domain (localStorage is per-domain)
2. Data was cleared from browser
3. Using different browser than original

**Solutions:**
- Check browser history for the correct URL
- Try all browsers you might have used
- Check **Application → Storage → Local Storage** in DevTools

### Issue: "Failed to parse localStorage data"

**Cause:** Corrupted data in localStorage

**Solution:**
- Use Method 3 to manually inspect and copy data
- Fix any JSON syntax errors
- Contact me with the error details

### Issue: "Migration failed"

**Causes:**
1. DATABASE_URL not set
2. Neon database not accessible
3. Default user doesn't exist

**Solutions:**
```bash
# Check DATABASE_URL
cat .env

# Run database setup
npm run db:setup

# Try migration again
npm run migrate-local-data
```

### Issue: "Data in localStorage but not in export"

**Solution:**
Make sure you're on the **exact same domain**:
- If you used `localhost:5000`, use that
- If you used `127.0.0.1:5000`, use that
- If you used deployed URL, use that

---

## 📞 Data Recovery Checklist

Before giving up, try:

- [ ] Check browser history for all URLs you used
- [ ] Try export from each URL/domain
- [ ] Check all browsers (Chrome, Firefox, Safari, Edge)
- [ ] Check DevTools → Application → Local Storage manually
- [ ] Export using both Method 1 and Method 2
- [ ] Check if data exists but with different keys
- [ ] Look for `journal-plan-*` in DevTools Storage search

---

## 💾 Backup Strategy Going Forward

Once migrated to Neon:

1. **Automatic Cloud Backup:** All data auto-saves to Neon
2. **Manual Export:** Use `/api/export/default-user/2025` endpoint
3. **Time Machine:** Previous versions saved in `timeline_index` table
4. **localStorage Fallback:** Still works offline as backup

---

## 🎯 Quick Reference

| Task | Command/Action |
|------|----------------|
| Export from browser | Visit `http://localhost:5000/export-localStorage.html` |
| View in DevTools | F12 → Application → Local Storage |
| Save export file | Name it `localStorage-backup.json` |
| Migrate to Neon | `npm run migrate-local-data` |
| Verify migration | Check console for "Loaded from database" |
| Check Neon | https://console.neon.tech |

---

**Your data is precious!** Export it now before making any changes. Once it's in Neon, it's safe in the cloud! 🎉
