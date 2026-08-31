import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { sendPushNotification, isPushEnabled } from '@/lib/firebase';
import { query } from '@/lib/db';

/**
 * POST /api/admin/push-notifications/test
 * Send a test notification to verify FCM configuration
 */
export async function POST(req: NextRequest) {
  const { error, user: actor } = await requirePermission(req, 'notifications.send');
  if (error) return error;

  try {
    const body = await req.json();
    const { recipient_type, recipient_id, title, body: messageBody } = body;

    // Validate inputs
    if (!recipient_type || !['partner', 'customer'].includes(recipient_type)) {
      return NextResponse.json(
        { error: 'recipient_type must be "partner" or "customer"' },
        { status: 400 }
      );
    }

    if (!recipient_id || typeof recipient_id !== 'number') {
      return NextResponse.json(
        { error: 'recipient_id is required and must be a number' },
        { status: 400 }
      );
    }

    if (!title || !messageBody) {
      return NextResponse.json(
        { error: 'title and body are required' },
        { status: 400 }
      );
    }

    // Check if push notifications are enabled
    const pushEnabled = await isPushEnabled();
    if (!pushEnabled) {
      return NextResponse.json(
        { error: 'Push notifications are not enabled. Configure Firebase credentials in Settings → Notifications.' },
        { status: 400 }
      );
    }

    // Get recipient's FCM tokens from new token tables
    const tokenTable = recipient_type === 'partner' ? 'partner_fcm_tokens' : 'customer_fcm_tokens';
    const userTable = recipient_type === 'partner' ? 'partners' : 'customers';
    const idColumn = recipient_type === 'partner' ? 'partner_id' : 'customer_id';
    
    // First check if recipient exists
    const recipients = await query<{ id: number; name: string | null; phone: string }[]>(
      `SELECT id, name, phone FROM ${userTable} WHERE id = ? AND deleted_at IS NULL`,
      [recipient_id]
    );

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: `${recipient_type} not found` },
        { status: 404 }
      );
    }

    const recipient = recipients[0];
    const recipientName = recipient.name || recipient.phone;

    // Get all active FCM tokens for this recipient
    const tokens = await query<{ fcm_token: string; device_type: string }[]>(
      `SELECT fcm_token, device_type FROM ${tokenTable} 
       WHERE ${idColumn} = ? AND deleted_at IS NULL`,
      [recipient_id]
    );

    if (tokens.length === 0) {
      return NextResponse.json(
        { 
          error: `${recipient_type} "${recipientName}" has not registered any FCM tokens yet. They need to open the app to register.`,
          recipient_name: recipientName,
        },
        { status: 400 }
      );
    }

    // Send test notification to all devices
    let successCount = 0;
    let failCount = 0;

    for (const token of tokens) {
      const success = await sendPushNotification(
        token.fcm_token,
        title,
        messageBody,
        { test: 'true', sent_by: actor!.email, device_type: token.device_type }
      );
      
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    if (successCount > 0) {
      return NextResponse.json({
        success: true,
        message: `Test notification sent to ${recipient_type} "${recipientName}" (${successCount}/${tokens.length} devices)`,
        recipient_name: recipientName,
        devices_sent: successCount,
        devices_failed: failCount,
        total_devices: tokens.length,
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to send notification to any device. Check Firebase credentials and token validity.' },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error('Test notification error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
