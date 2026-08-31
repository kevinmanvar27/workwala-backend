import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

/**
 * GET /api/partner/notifications/[id]
 * Fetch a single notification by log ID for the authenticated partner.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'partner');
    if (authError) return authError;

    const partnerId = payload!.userId;
    const { id } = await params;
    const notificationLogId = parseInt(id, 10);

    if (isNaN(notificationLogId)) {
      return NextResponse.json(
        { success: false, message: 'Invalid notification ID' },
        { status: 400 }
      );
    }

    const rows = await query<RowDataPacket[]>(
      `SELECT
        pnl.id,
        pnl.notification_id,
        pn.title,
        pn.body AS message,
        pn.category_id,
        nc.name AS category_name,
        nc.slug AS type,
        pn.image_url,
        pn.action_url,
        pnl.status,
        pnl.opened_at,
        pnl.created_at,
        CASE WHEN pnl.opened_at IS NOT NULL THEN 1 ELSE 0 END AS is_read
      FROM push_notification_logs pnl
      INNER JOIN push_notifications pn ON pnl.notification_id = pn.id
      LEFT JOIN notification_categories nc ON pn.category_id = nc.id
      WHERE pnl.id = ?
        AND pnl.recipient_type = 'partner'
        AND pnl.recipient_id = ?
        AND pn.deleted_at IS NULL
      LIMIT 1`,
      [notificationLogId, partnerId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Notification not found' },
        { status: 404 }
      );
    }

    const row = rows[0];
    return NextResponse.json({
      success: true,
      notification: {
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
      },
    });
  } catch (error: any) {
    console.error('[GET /api/partner/notifications/[id]] Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch notification' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/partner/notifications/[id]
 * Delete a notification log entry for the partner.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'partner');
    if (authError) return authError;

    const partnerId = payload!.userId;
    const { id } = await params;
    const notificationLogId = parseInt(id, 10);

    if (isNaN(notificationLogId)) {
      return NextResponse.json(
        { success: false, message: 'Invalid notification ID' },
        { status: 400 }
      );
    }

    const result = await query<ResultSetHeader>(
      `DELETE FROM push_notification_logs
       WHERE id = ?
         AND recipient_type = 'partner'
         AND recipient_id = ?`,
      [notificationLogId, partnerId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: 'Notification not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error: any) {
    console.error('[DELETE /api/partner/notifications/[id]] Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to delete notification' },
      { status: 500 }
    );
  }
}
