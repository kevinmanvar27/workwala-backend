import jwt from 'jsonwebtoken';

// Hard-fail at module load time — never fall back to a known/guessable string.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    '[jwt] JWT_SECRET environment variable is not set. ' +
    'Add a strong random value to .env.local before starting the server.'
  );
}

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
if (!JWT_REFRESH_SECRET) {
  throw new Error(
    '[jwt] JWT_REFRESH_SECRET environment variable is not set. ' +
    'Add a strong random value (different from JWT_SECRET) to .env.local.'
  );
}

export interface JWTPayload {
  userId: number;
  email: string;
  roleSlug: string;
  roleName: string;
  tokenVersion?: number;
}

/**
 * Signs a long-lived access token (30 days) for admin panel and mobile clients.
 * Security is maintained via tokenVersion — incrementing it in the DB
 * (on logout or account suspension) immediately invalidates all issued tokens.
 * Session persists until explicit logout or token expiration.
 */
export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: '30d' });
}

/**
 * Signs a long-lived refresh token (90 days).
 * Stored in an httpOnly cookie; never exposed to JavaScript.
 * Allows extended admin sessions without frequent re-authentication.
 */
export function signRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET!, { expiresIn: '90d' });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET!) as JWTPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET!) as JWTPayload;
  } catch {
    return null;
  }
}
