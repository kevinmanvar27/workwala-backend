import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerAuth } from '@/lib/auth';
import { query } from '@/lib/db';

/**
 * POST /api/customer/fcm/register
 * Register or update FCM token for the authenticated customer
 * Supports multiple devices per customer
 */
export async function POST(req: NextRequest) {
  const customerId = await verifyCustomerAuth(req);
  if (!customerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { fcm_token, device_type = 'android', device_id } = body;

    if (!fcm_token || typeof fcm_token !== 'string' || fcm_token.trim() === '') {
      return NextResponse.json(
        { error: 'fcm_token is required' },
        { status: 400 }
      );
    }

    // Validate device_type
    const validDeviceTypes = ['ios', 'android', 'web'];
    const deviceType = validDeviceTypes.includes(device_type) ? device_type : 'android';

    // Insert or update FCM token in customer_fcm_tokens table
    // This supports multiple devices per customer
    await query(
      `INSERT INTO customer_fcm_tokens 
        (customer_id, fcm_token, device_type, device_id, last_used_at, created_at) 
       VALUES (?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE 
        device_type = VALUES(device_type),
        device_id = VALUES(device_id),
        last_used_at = NOW(),
        deleted_at = NULL`,
      [customerId, fcm_token.trim(), deviceType, device_id || null]
    );

    // Also update the legacy fcm_token column in customers table for backward compatibility
    await query(
      `UPDATE customers SET fcm_token = ?, updated_at = NOW() WHERE id = ?`,
      [fcm_token.trim(), customerId]
    );

    console.log(`✅ [FCM] Customer ${customerId} registered ${deviceType} token: ${fcm_token.substring(0, 20)}...`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Customer FCM registration error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
