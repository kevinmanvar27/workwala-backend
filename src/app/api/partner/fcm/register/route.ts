import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth';
import { query } from '@/lib/db';

/**
 * POST /api/partner/fcm/register
 * Register or update FCM token for the authenticated partner
 */
export async function POST(req: NextRequest) {
  const partnerId = await verifyPartnerAuth(req);
  if (!partnerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { fcm_token } = body;

    if (!fcm_token || typeof fcm_token !== 'string' || fcm_token.trim() === '') {
      return NextResponse.json(
        { error: 'fcm_token is required' },
        { status: 400 }
      );
    }

    // Update partner's FCM token
    await query(
      `UPDATE partners SET fcm_token = ?, updated_at = NOW() WHERE id = ?`,
      [fcm_token.trim(), partnerId]
    );

    console.log(`✅ [FCM] Partner ${partnerId} registered token: ${fcm_token.substring(0, 20)}...`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Partner FCM registration error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
