import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';
import type { RowDataPacket } from 'mysql2';

/**
 * GET /api/customer/notifications
 * Fetch all notifications for the authenticated customer
 */
export async function GET(req: NextRequest) {
  try {
    // Verify customer token
    const { error: authError, user: payload } = await requireMobileAuth(req, 'customer');
    if (authError) return authError;

    const customerId = payload!.userId;

    // Fetch notifications from push_notification_logs joined with push_notifications
    // for this customer (recipient_type='customer' AND recipient_id=customerId)
    const rows = await query<RowDataPacket[]>(
      `SELECT 
        pnl.id,
        pnl.notification_id,
        pn.title,
        pn.body as message,
        pn.category_id,
        nc.name as category_name,
        nc.slug as type,
        pn.image_url,
        pn.action_url,
        pnl.status,
        pnl.opened_at,
        pnl.created_at,
        CASE 
          WHEN pnl.opened_at IS NOT NULL THEN 1
          ELSE 0
        END as is_read
      FROM push_notification_logs pnl
      INNER JOIN push_notifications pn ON pnl.notification_id = pn.id
      LEFT JOIN notification_categories nc ON pn.category_id = nc.id
      WHERE pnl.recipient_type = 'customer'
        AND pnl.recipient_id = ?
        AND pn.deleted_at IS NULL
      ORDER BY pnl.created_at DESC
      LIMIT 100`,
      [customerId]
    );

    // Transform the data to match the expected format
    const notifications = rows.map((row) => ({
      id: row.id,
      notification_id: row.notification_id,
      title: row.title,
      message: row.message,
      type: row.type || 'general',
      category_name: row.category_name,
      image_url: row.image_url,
      action_url: row.action_url,
      status: row.status,
      is_read: row.is_read === 1,
      created_at: row.created_at,
      opened_at: row.opened_at,
    }));

    return NextResponse.json({
      success: true,
      notifications,
      unread_count: notifications.filter((n) => !n.is_read).length,
    });
  } catch (error: any) {
    console.error('[GET /api/customer/notifications] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to fetch notifications',
      },
      { status: 500 }
    );
  }
}
