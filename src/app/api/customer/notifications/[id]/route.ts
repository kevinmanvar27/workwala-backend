import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';
import type { ResultSetHeader } from 'mysql2';

/**
 * DELETE /api/customer/notifications/:id
 * Delete a notification log entry for the customer
 */
export async function DELETE(
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

    // Delete the notification log entry
    // Only if it belongs to this customer
    const result = await query<ResultSetHeader>(
      `DELETE FROM push_notification_logs 
      WHERE id = ?
        AND recipient_type = 'customer'
        AND recipient_id = ?`,
      [notificationLogId, customerId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Notification not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error: any) {
    console.error('[DELETE /api/customer/notifications/:id] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to delete notification',
      },
      { status: 500 }
    );
  }
}
