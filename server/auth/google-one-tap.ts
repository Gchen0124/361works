import { OAuth2Client } from 'google-auth-library';
import { storage, type GoogleProfile } from '../storage';
import { generateToken } from './jwt';
import type { Request, Response } from 'express';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

interface GoogleTokenPayload {
  sub: string; // Google user ID
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

export async function handleGoogleOneTap(req: Request, res: Response) {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: 'Missing credential' });
    }

    // Verify the Google ID token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID!,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      return res.status(400).json({ message: 'Invalid token' });
    }

    const googlePayload = payload as GoogleTokenPayload;

    // Check if user exists by Google ID
    let user = await storage.getUserByGoogleId(googlePayload.sub);

    // If not found, check by email (account linking)
    if (!user && googlePayload.email) {
      user = await storage.getUserByEmail(googlePayload.email);

      if (user) {
        console.log(`✅ Linking Google account to existing user: ${user.email}`);
        // TODO: Add method to link Google ID if needed
      }
    }

    // Create new user if doesn't exist
    if (!user) {
      const profile: GoogleProfile = {
        id: googlePayload.sub,
        email: googlePayload.email,
        displayName: googlePayload.name,
        photos: googlePayload.picture ? [{ value: googlePayload.picture }] : undefined,
      };

      user = await storage.createGoogleUser(profile);
      console.log(`✅ Created new user via Google One Tap: ${user.email}`);
    }

    // Update last login
    await storage.updateUserLastLogin(user.id);

    // Generate JWT
    const token = generateToken({
      userId: user.id,
      email: user.email || '',
      displayName: user.display_name || user.username,
      avatar: user.avatar_url || undefined,
    });

    // Set httpOnly cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    // Return user info
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name || user.username,
        avatar: user.avatar_url,
      },
    });
  } catch (error) {
    console.error('❌ Google One Tap authentication error:', error);
    res.status(500).json({
      message: 'Authentication failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
