# Deploy DailyGlass to Render.com with Neon Database

This guide will help you deploy your DailyGlass app to Render.com using Neon as the PostgreSQL database.

## ✅ Prerequisites

- [x] Neon account created (https://neon.tech)
- [x] Neon database connection string (you have this)
- [ ] Render.com account (https://render.com)
- [ ] Code pushed to GitHub

## 🚀 Deployment Steps

### Step 1: Push Database Schema to Neon

First, make sure your local code has the latest changes and the database schema is pushed to Neon:

```bash
# Make sure DATABASE_URL is in your .env file
npm run db:test     # Test connection (optional)
npm run db:push     # Push schema to Neon database
```

### Step 2: Create Web Service on Render

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository (`Gchen0124/361works`)
4. Configure the service:

   **Settings:**
   - **Name:** `dailyglass` (or your preferred name)
   - **Region:** Same as your Neon database (US West 2)
   - **Branch:** `main` (or your deployment branch)
   - **Root Directory:** leave blank
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free` (or choose paid tier)

### Step 3: Add Environment Variables

In the Render dashboard, under **Environment**, add:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `postgresql://neondb_owner:npg_M8fbA0iFYhJl@ep-bitter-frost-afcrmobv-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require` |
| `NODE_ENV` | `production` |
| `PORT` | `5001` |

### Step 4: Deploy

1. Click **"Create Web Service"**
2. Render will automatically:
   - Clone your repo
   - Run `npm install && npm run build`
   - Start the server with `npm start`
   - Apply database migrations on startup

### Step 5: Verify Deployment

Once deployed, Render will give you a URL like: `https://dailyglass.onrender.com`

Test your deployment:
1. Visit your Render URL
2. Open browser DevTools → Console
3. You should see database connection logs
4. Try creating a journal entry to test data persistence

## 🔧 Troubleshooting

### Issue: "DATABASE_URL environment variable is not set"

**Solution:** Make sure you added `DATABASE_URL` to Render's environment variables.

### Issue: "Migration failed" or "Tables not found"

**Solution:**
1. Check Render logs for specific errors
2. Ensure you pushed schema to Neon: `npm run db:push`
3. Verify DATABASE_URL is correct in Render environment

### Issue: "Connection timeout" or "Cannot reach database"

**Solution:**
1. Ensure Neon database is in the same region as Render (or nearby)
2. Check Neon dashboard to ensure database is active
3. Verify connection string is correct (copy from Neon dashboard)

### Issue: Data not persisting

**Solution:**
1. Check Render logs: `https://dashboard.render.com` → Your Service → Logs
2. Look for database connection errors
3. Verify migrations ran successfully on startup

## 📊 Monitoring

### Check Database Tables

Run locally:
```bash
npm run db:studio
```

This opens Drizzle Studio at `https://local.drizzle.studio` where you can:
- View all tables and data
- Run SQL queries
- Monitor data changes in real-time

### View Render Logs

```bash
# From Render dashboard:
1. Go to your service
2. Click "Logs" tab
3. Look for startup messages:
   - ✅ Database migrations completed
   - ✅ Database tables already exist
```

## 🔄 Updating Your Deployment

When you push changes to GitHub:

1. **Automatic Deployment:**
   - Render auto-deploys on every push to main branch
   - Migrations run automatically on startup

2. **Manual Deployment:**
   - Go to Render dashboard
   - Click "Manual Deploy" → "Deploy latest commit"

## 💾 Database Backups

Neon provides automatic backups. To restore:

1. Go to Neon dashboard
2. Select your project
3. Go to "Backups" tab
4. Choose a backup point to restore

## 🎯 Next Steps

After successful deployment:

- [ ] Test multi-device sync (access from different browsers/devices)
- [ ] Test offline functionality (disconnect internet, make changes, reconnect)
- [ ] Set up custom domain in Render (optional)
- [ ] Configure weekly database backups
- [ ] Monitor performance in Render dashboard

## 📞 Support

- Render Support: https://render.com/docs
- Neon Support: https://neon.tech/docs
- Project Issues: https://github.com/Gchen0124/361works/issues

---

**Your Connection Details:**
- Neon Host: `ep-bitter-frost-afcrmobv-pooler.c-2.us-west-2.aws.neon.tech`
- Database: `neondb`
- Region: US West 2
