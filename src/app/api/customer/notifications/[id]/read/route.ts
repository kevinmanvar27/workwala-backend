import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';
import type { ResultSetHeader } from 'mysql2';

/**
 * POST /api/customer/notifications/:id/read
 * Mark a notification as read (opened)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify customer token
    const { error: authError, user: payload } = await requireMobileAuth(req, 'customer');
    if (authError) return authError;

    const customerId = payload!.userId;
    const { id } = await params;
    const notificationLogId = parseInt(id, 10);

    if (isNaN(notificationLogId)) {
      return NextResponse.json(
        { success: false, message: 'Invalid notification ID' },
        { status: 400 }
      );
    }

    // Update the notification log to mark as opened
    // Only if it belongs to this customer
    const result = await query<ResultSetHeader>(
      `UPDATE push_notification_logs 
      SET opened_at = NOW(),
          status = 'opened'
      WHERE id = ?
        AND recipient_type = 'customer'
        AND recipient_id = ?
        AND opened_at IS NULL`,
      [notificationLogId, customerId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Notification not found or already read',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error: any) {
    console.error('[POST /api/customer/notifications/:id/read] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to mark notification as read',
      },
      { status: 500 }
    );
  }
}
