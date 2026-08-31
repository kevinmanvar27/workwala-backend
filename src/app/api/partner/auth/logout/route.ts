import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth, revokeMobileTokens } from '@/lib/mobileAuth';

/**
 * POST /api/partner/auth/logout
 *
 * 1. Marks the partner as offline (is_online = 0).
 * 2. Revokes the partner's JWT by incrementing token_version in the DB.
 *    Any previously issued token with an older tokenVersion will be rejected
 *    by requireMobileAuth on the next request.
 *
 * The Flutter app must also call ApiService.deleteToken() locally.
 */
export async function POST(req: NextRequest) {
  const { error, user } = await requireMobileAuth(req, 'partner');
  if (error) return error;

  // Mark partner offline — safe fallback if is_online column not yet migrated
  try {
    await query(
      `UPDATE partners SET is_online = 0, updated_at = NOW() WHERE id = ?`,
      [user!.userId]
    );
  } catch (colErr: unknown) {
    const msg = colErr instanceof Error ? colErr.message : String(colErr);
    if (!msg.includes('is_online')) throw colErr;
    // Column not yet added — skip silently
  }

  await revokeMobileTokens(user!.userId, 'partner');

  return NextResponse.json({ success: true, message: 'Logged out successfully.' });
}
