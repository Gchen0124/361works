import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { storage, type GoogleProfile } from '../storage';
import { generateToken } from './jwt';
import type { Response } from 'express';

export async function handleGoogleCallback(
  profile: Profile,
  res: Response
): Promise<void> {
  try {
    // 1. Check if user exists by Google ID
    let user = await storage.getUserByGoogleId(profile.id);

    // 2. If not, check by email (account merging)
    if (!user && profile.emails?.[0]?.value) {
      user = await storage.getUserByEmail(profile.emails[0].value);

      // If found by email, link Google account
      if (user) {
        console.log(`✅ Found existing user by email, linking Google account: ${user.id}`);
        // TODO: Add method to link Google ID to existing user if needed
      }
    }

    // 3. Create new user if doesn't exist
    if (!user) {
      const googleProfile: GoogleProfile = {
        id: profile.id,
        email: profile.emails?.[0]?.value || '',
        displayName: profile.displayName,
        photos: profile.photos,
      };

      user = await storage.createGoogleUser(googleProfile);
      console.log(`✅ Created new Google user: ${user.email}`);
    }

    // 4. Update last login
    await storage.updateUserLastLogin(user.id);

    // 5. Generate JWT
    const token = generateToken({
      userId: user.id,
      email: user.email || '',
      displayName: user.display_name || user.username,
      avatar: user.avatar_url || undefined,
    });

    // 6. Set httpOnly cookie
    res.cookie('auth_token', token, {
      httpOnly: true, // Prevent XSS
      secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
      sameSite: 'lax', // CSRF protection
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    // 7. Redirect to app
    res.redirect('/');
  } catch (error) {
    console.error('❌ Google OAuth error:', error);
    res.redirect('/login?error=oauth_failed');
  }
}

export function createGoogleStrategy() {
  return new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5001/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      // Passport callback - we handle auth in route instead
      done(null, profile);
    }
  );
}
