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

    // Get recipient's FCM token
    const tableName = recipient_type === 'partner' ? 'partners' : 'customers';
    const recipients = await query<{ id: number; name: string; fcm_token: string | null }[]>(
      `SELECT id, COALESCE(name, phone) as name, fcm_token 
       FROM ${tableName} 
       WHERE id = ? AND deleted_at IS NULL`,
      [recipient_id]
    );

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: `${recipient_type} not found` },
        { status: 404 }
      );
    }

    const recipient = recipients[0];

    if (!recipient.fcm_token || recipient.fcm_token.trim() === '') {
      return NextResponse.json(
        { 
          error: `${recipient_type} "${recipient.name}" has not registered an FCM token yet. They need to open the app to register.`,
          recipient_name: recipient.name,
        },
        { status: 400 }
      );
    }

    // Send test notification
    const success = await sendPushNotification(
      recipient.fcm_token,
      title,
      messageBody,
      { test: 'true', sent_by: actor!.email }
    );

    if (success) {
      return NextResponse.json({
        success: true,
        message: `Test notification sent to ${recipient_type} "${recipient.name}"`,
        recipient_name: recipient.name,
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to send notification. Check Firebase credentials and token validity.' },
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
