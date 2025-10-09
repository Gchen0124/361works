import type { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromCookie } from './jwt';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: {
        id: string;
        email: string;
        displayName: string;
        avatar?: string;
      };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Extract token from cookie
  const token = extractTokenFromCookie(req.headers.cookie);

  if (!token) {
    return res.status(401).json({
      message: 'Authentication required',
      code: 'NO_TOKEN'
    });
  }

  // Verify token
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({
      message: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    });
  }

  // Inject user info into request
  req.userId = payload.userId;
  req.user = {
    id: payload.userId,
    email: payload.email,
    displayName: payload.displayName,
    avatar: payload.avatar,
  };

  next();
}

// Optional: Check if authenticated but don't block
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractTokenFromCookie(req.headers.cookie);

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.userId = payload.userId;
      req.user = {
        id: payload.userId,
        email: payload.email,
        displayName: payload.displayName,
        avatar: payload.avatar,
      };
    }
  }

  next(); // Continue regardless of auth status
}
