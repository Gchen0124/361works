# 🚀 NEXT STEPS: Turso + Vercel Deployment

## ✅ What's Complete

- ✅ Google One Tap authentication working locally
- ✅ JWT-based stateless auth (perfect for serverless)
- ✅ Protected routes in frontend
- ✅ User database with OAuth fields
- ✅ All changes committed to `online-deployment` branch

---

## 📋 DEPLOYMENT ROADMAP

### **Phase 1: Database Migration to Turso** (30-45 min)

#### Why Turso?
- ✅ Cloud-hosted SQLite (keeps our schema)
- ✅ Globally distributed (fast worldwide)
- ✅ Free tier: 9GB storage, 500 rows/s
- ✅ Zero code changes (uses same Drizzle ORM)
- ✅ Perfect for serverless (Vercel)

#### Steps:

**1.1 Install Turso CLI**
```bash
# Mac/Linux
curl -sSfL https://get.tur.so/install.sh | bash

# Or via Homebrew
brew install tursodatabase/tap/turso

# Login
turso auth login
```

**1.2 Create Turso Database**
```bash
# Create database
turso db create dailyglass --location sfo

# Get connection details
turso db show dailyglass --url
# Output: libsql://dailyglass-[username].turso.io

# Generate auth token
turso db tokens create dailyglass
# Output: eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
```

**1.3 Update Code for Turso**

**File: `drizzle.config.ts`**
```typescript
import type { Config } from "drizzle-kit";

export default {
  schema: "./shared/schema.ts",
  out: "./drizzle",
  dialect: process.env.NODE_ENV === 'production' ? "turso" : "sqlite",
  dbCredentials: process.env.NODE_ENV === 'production'
    ? {
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN!,
      }
    : {
        url: process.env.LOCAL_SQLITE_PATH || "./data/dailyglass.db",
      },
} satisfies Config;
```

**File: `server/db.ts`** (UPDATE)
```typescript
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "@shared/schema";

// Create client based on environment
const client = process.env.NODE_ENV === 'production'
  ? createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    })
  : createClient({
      url: `file:${process.env.LOCAL_SQLITE_PATH || "./data/dailyglass.db"}`,
    });

export const db = drizzle(client, { schema });

// Async initialization
export async function initializeDatabase() {
  try {
    const tables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );

    if (!tables.rows.some((r: any) => r.name === 'users')) {
      console.log("🔄 Running database migrations...");
      // Run migrations
      await runMigrations();
      console.log("✅ Database migrations completed");
    }
  } catch (error) {
    console.error("⚠️ Database initialization error:", error);
  }
}
```

**1.4 Install Turso Client**
```bash
npm install @libsql/client
```

**1.5 Migrate Schema to Turso**
```bash
# Push schema to Turso
turso db shell dailyglass < drizzle/0000_overrated_iron_fist.sql
turso db shell dailyglass < drizzle/0001_marvelous_devos.sql

# Verify
turso db shell dailyglass "SELECT COUNT(*) FROM users;"
```

**1.6 Test Locally with Turso**
```bash
# Add to .env
TURSO_DATABASE_URL=libsql://dailyglass-[username].turso.io
TURSO_AUTH_TOKEN=eyJhbGci...

# Test connection
NODE_ENV=production npm run dev
```

---

### **Phase 2: Vercel Deployment Setup** (20-30 min)

#### Why Vercel?
- ✅ Zero-config deployment for Vite + Express
- ✅ Free tier: 100GB bandwidth, unlimited requests
- ✅ Automatic HTTPS + CDN
- ✅ Perfect for our JWT stateless auth
- ✅ Environment variable management

#### Steps:

**2.1 Create Vercel Configuration**

**File: `vercel.json`** (NEW)
```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "framework": null,
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/index.js"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "functions": {
    "api/**/*.js": {
      "memory": 1024,
      "maxDuration": 10
    }
  }
}
```

**2.2 Update Build Scripts**

**File: `package.json`** (UPDATE)
```json
{
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "npm run build:client && npm run build:server",
    "build:client": "vite build",
    "build:server": "esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist/api --outfile=index.js",
    "start": "NODE_ENV=production node dist/api/index.js",
    "vercel-build": "npm run build"
  }
}
```

**2.3 Install Vercel CLI**
```bash
npm install -g vercel

# Login
vercel login

# Link project
vercel link
```

**2.4 Set Environment Variables**
```bash
# Add all env vars to Vercel
vercel env add TURSO_DATABASE_URL production
# Paste: libsql://dailyglass-xxx.turso.io

vercel env add TURSO_AUTH_TOKEN production
# Paste token

vercel env add GOOGLE_CLIENT_ID production
# Paste: 557178244855-fv21lpkmsgtes5ubf8ph831tqils22et.apps.googleusercontent.com

vercel env add JWT_SECRET production
# Generate: openssl rand -base64 32 | pbcopy

vercel env add VITE_GOOGLE_CLIENT_ID production
# Same as GOOGLE_CLIENT_ID
```

**2.5 Update Google OAuth Credentials**
1. Go to https://console.cloud.google.com/apis/credentials
2. Click your OAuth 2.0 Client ID
3. Add to **Authorized JavaScript origins**:
   - `https://your-app.vercel.app`
   - `https://your-app-*.vercel.app` (for preview deployments)

**2.6 Deploy to Vercel**
```bash
# Deploy preview
vercel

# Deploy to production
vercel --prod
```

---

### **Phase 3: Backend Routes Cleanup** (Optional, 20 min)

Currently some routes still use `:userId` in URL. Clean them up:

**Update these routes to use `req.userId` from JWT:**
- `/api/matrix/reality` - Add `requireAuth`, use `req.userId`
- `/api/matrix/:userId/:year/daily` → `/api/matrix/daily/:year`
- `/api/matrix/:userId/:year/plans` → `/api/matrix/plans/:year`
- `/api/matrix/:userId/:year/realities` → `/api/matrix/realities/:year`
- `/api/timemachine/:userId/:year/*` → `/api/timemachine/:year/*`
- `/api/export/:userId/:year` → `/api/export/:year`

**Pattern:**
```typescript
// BEFORE
app.get("/api/matrix/:userId/:year/daily", async (req, res) => {
  const { userId, year } = req.params;
  // ...
});

// AFTER
app.get("/api/matrix/daily/:year", requireAuth, async (req, res) => {
  const userId = req.userId!; // From JWT
  const { year } = req.params;
  // ...
});
```

---

### **Phase 4: LLM Integration** (Future - 2-3 hours)

Once deployed, you can add AI features:

**4.1 Add LLM Chat Endpoint**
```typescript
// POST /api/llm/chat
app.post("/api/llm/chat", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const { message, year } = req.body;

  // Fetch user's journal data
  const data = await storage.exportYearData(userId, year);

  // Build context from entries
  const context = buildJournalContext(data);

  // Send to Claude/GPT with context
  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    system: `You are a journal assistant. User's ${year} entries:\n${context}`,
    messages: [{ role: "user", content: message }]
  });

  res.json({ reply: response.content[0].text });
});
```

**4.2 Frontend Chat Component**
```tsx
function JournalChat({ year }) {
  const [messages, setMessages] = useState([]);

  async function ask(question) {
    const response = await fetch('/api/llm/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ message: question, year })
    });

    const { reply } = await response.json();
    setMessages([...messages, { q: question, a: reply }]);
  }

  return (
    <div>
      {messages.map((m, i) => (
        <div key={i}>
          <p><strong>You:</strong> {m.q}</p>
          <p><strong>AI:</strong> {m.a}</p>
        </div>
      ))}
    </div>
  );
}
```

---

## 🎯 RECOMMENDED ORDER

### **Immediate (This Week)**
1. ✅ Test Google auth locally (DONE!)
2. → Migrate to Turso (Phase 1)
3. → Deploy to Vercel (Phase 2)
4. → Test production deployment

### **Short-term (Next Week)**
5. Clean up backend routes (Phase 3)
6. Add logout button in UI
7. Add user profile dropdown
8. Test with multiple users

### **Medium-term (Future)**
9. LLM integration (Phase 4)
10. Add user settings page
11. Add data export UI button
12. Add email notifications (optional)

---

## 📊 DEPLOYMENT CHECKLIST

### Before Deploying:
- [ ] Turso database created
- [ ] Turso migrations run
- [ ] Vercel account set up
- [ ] Google OAuth updated with production URL
- [ ] Environment variables configured in Vercel
- [ ] Test build locally: `npm run build`

### After Deploying:
- [ ] Verify https://your-app.vercel.app loads
- [ ] Test Google sign-in on production
- [ ] Verify user created in Turso database
- [ ] Test journal create/read/update
- [ ] Test export functionality
- [ ] Monitor Vercel function logs

---

## 🐛 Common Issues & Fixes

### "CORS Error" on production
```typescript
// server/index.ts
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://your-app.vercel.app']
    : true,
  credentials: true,
};
```

### "Function timeout" (Vercel)
- Default: 10s, Max: 60s (Pro plan)
- Optimize database queries
- Add indexes to frequently queried columns

### "Database locked" (Turso)
- Turso handles this automatically
- Use transactions for multiple writes

---

## 💰 Cost Estimate (Monthly)

| Service | Free Tier | Paid (if exceeded) |
|---------|-----------|-------------------|
| **Turso** | 9GB storage, 500 rows/s | $29/mo |
| **Vercel** | 100GB bandwidth | $20/mo Pro |
| **Google OAuth** | Unlimited | Free |
| **Total** | $0/mo | ~$50/mo at scale |

---

## 📚 Documentation to Update

After deployment:
1. Update README.md with:
   - Live demo URL
   - Setup instructions
   - Architecture diagram
2. Add DEPLOYMENT.md with:
   - Step-by-step deployment guide
   - Troubleshooting section
3. Update TESTING_GUIDE.md:
   - Add production testing steps

---

**Next Action:** Start Phase 1 (Turso migration)?

Let me know when you're ready to proceed!
