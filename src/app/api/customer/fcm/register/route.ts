import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerAuth } from '@/lib/auth';
import { query } from '@/lib/db';

/**
 * POST /api/customer/fcm/register
 * Register or update FCM token for the authenticated customer
 */
export async function POST(req: NextRequest) {
  const customerId = await verifyCustomerAuth(req);
  if (!customerId) {
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

    // Update customer's FCM token
    await query(
      `UPDATE customers SET fcm_token = ?, updated_at = NOW() WHERE id = ?`,
      [fcm_token.trim(), customerId]
    );

    console.log(`✅ [FCM] Customer ${customerId} registered token: ${fcm_token.substring(0, 20)}...`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Customer FCM registration error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
