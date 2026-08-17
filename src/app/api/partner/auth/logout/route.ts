import { NextRequest, NextResponse } from 'next/server';
import { requireMobileAuth, revokeMobileTokens } from '@/lib/mobileAuth';

/**
 * POST /api/partner/auth/logout
 *
 * Revokes the partner's JWT by incrementing token_version in the DB.
 * Any previously issued token with an older tokenVersion will be rejected
 * by requireMobileAuth on the next request.
 *
 * The Flutter app must also call ApiService.deleteToken() locally.
 */
export async function POST(req: NextRequest) {
  const { error, user } = await requireMobileAuth(req, 'partner');
  if (error) return error;

  await revokeMobileTokens(user!.userId, 'partner');

  return NextResponse.json({ success: true, message: 'Logged out successfully.' });
}
