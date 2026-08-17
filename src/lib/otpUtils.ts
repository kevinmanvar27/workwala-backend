import { randomInt, createHmac } from 'crypto';

/**
 * Generates a cryptographically secure 6-digit OTP string.
 * Uses Node.js crypto.randomInt — NOT Math.random() which is NOT cryptographically secure.
 */
export function generateOtp(): string {
  return randomInt(100000, 1000000).toString();
}

/**
 * HMAC-SHA256 hashes an OTP before storing it in the database.
 * Uses OTP_PEPPER from environment so even a full DB dump cannot reveal OTPs.
 * Throws at call-time if OTP_PEPPER is not set — never silently falls back.
 */
export function hashOtp(otp: string): string {
  const pepper = process.env.OTP_PEPPER;
  if (!pepper) {
    throw new Error(
      '[otpUtils] OTP_PEPPER environment variable is not set. ' +
      'Add a strong random value to .env.local before starting the server.'
    );
  }
  return createHmac('sha256', pepper).update(otp).digest('hex');
}
