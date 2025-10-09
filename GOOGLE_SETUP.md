# 🔐 Google One Tap Setup Guide

## Step 1: Create Google Cloud Project

1. Go to https://console.cloud.google.com
2. Click "Select a project" → "New Project"
3. Name: "DailyGlass" (or your preferred name)
4. Click "Create"

## Step 2: Enable Google Identity Services

1. In the Google Cloud Console, select your project
2. Go to "APIs & Services" → "Library"
3. Search for "Google Identity Services"
4. Click "Enable"

## Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "+ CREATE CREDENTIALS" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - User Type: External (for testing)
   - App name: DailyGlass
   - User support email: Your email
   - Developer contact: Your email
   - Save and Continue
   - Scopes: Skip (default scopes are fine)
   - Test users: Add your email
   - Save and Continue

4. Create OAuth Client ID:
   - Application type: **Web application**
   - Name: "DailyGlass Web Client"

   - **Authorized JavaScript origins:**
     - http://localhost:5001
     - (Later add: https://your-vercel-app.vercel.app)

   - **Authorized redirect URIs:** Leave empty (not needed for One Tap)

   - Click "Create"

5. **Copy the Client ID** (looks like: `123456789-abcdefg.apps.googleusercontent.com`)

## Step 4: Add Client ID to Your Project

1. Update `.env` file in project root:
   ```bash
   GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
   ```

2. Update `client/.env` file:
   ```bash
   VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
   ```

3. Restart your dev server:
   ```bash
   # Kill old server (Ctrl+C)
   npm run dev
   ```

## Step 5: Test Google One Tap

1. Open http://localhost:5001/login
2. You should see the Google Sign-In button
3. Click it to test the popup login
4. Approve permissions
5. You should be logged in!

## Troubleshooting

### "Popup blocked"
- Allow popups for localhost:5001 in your browser

### "Client ID not found"
- Make sure you copied the full Client ID
- Restart the dev server after updating `.env` files

### "Unauthorized JavaScript origin"
- Make sure you added `http://localhost:5001` to authorized origins
- Note: http (not https) for local development

### "Email not verified" or "Access blocked"
- Add your email to "Test users" in OAuth consent screen
- While in development mode, only test users can sign in

## Production Setup

When deploying to Vercel:

1. Add production URL to authorized origins:
   - https://your-app.vercel.app

2. Add environment variables in Vercel dashboard:
   - `GOOGLE_CLIENT_ID` (same value)
   - `VITE_GOOGLE_CLIENT_ID` (same value)

3. Publish OAuth consent screen (after testing)
