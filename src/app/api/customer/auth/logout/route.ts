import { NextRequest, NextResponse } from 'next/server';
import { requireMobileAuth, revokeMobileTokens } from '@/lib/mobileAuth';

/**
 * POST /api/customer/auth/logout
 *
 * Revokes the customer's JWT by incrementing token_version in the DB.
 * Any previously issued token with an older tokenVersion will be rejected
 * by requireMobileAuth on the next request.
 *
 * The Flutter app must also call ApiService.deleteToken() locally.
 */
export async function POST(req: NextRequest) {
  const { error, user } = await requireMobileAuth(req, 'customer');
  if (error) return error;

  await revokeMobileTokens(user!.userId, 'customer');

  return NextResponse.json({ success: true, message: 'Logged out successfully.' });
}
