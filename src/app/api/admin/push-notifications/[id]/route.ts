import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';

// GET /api/admin/push-notifications/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission(req, 'notifications.view');
  if (error) return error;

  try {
    const { id } = await params;
    const notifId = parseInt(id);
    if (isNaN(notifId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const [notif] = await query<{
      id: number;
      title: string;
      body: string;
      category_id: number | null;
      category_name: string | null;
      category_color: string | null;
      image_url: string | null;
      action_url: string | null;
      audience_type: string;
      audience_filters: string;
      estimated_recipients: number;
      actual_recipients: number;
      delivered_count: number;
      failed_count: number;
      opened_count: number;
      clicked_count: number;
      priority: string;
      status: string;
      scheduled_at: string | null;
      sent_at: string | null;
      channels: string;
      notes: string | null;
      created_by: number | null;
      created_by_name: string | null;
      created_at: string;
      updated_at: string;
    }[]>(
      `SELECT
         pn.id, pn.title, pn.body,
         pn.category_id, nc.name as category_name, nc.color as category_color,
         pn.image_url, pn.action_url,
         pn.audience_type, pn.audience_filters,
         pn.estimated_recipients, pn.actual_recipients,
         pn.delivered_count, pn.failed_count, pn.opened_count, pn.clicked_count,
         pn.priority, pn.status,
         pn.scheduled_at, pn.sent_at,
         pn.channels, pn.notes,
         pn.created_by, pn.created_by_name,
         pn.created_at, pn.updated_at
       FROM push_notifications pn
       LEFT JOIN notification_categories nc ON nc.id = pn.category_id
       WHERE pn.id = ? AND pn.deleted_at IS NULL`,
      [notifId]
    );

    if (!notif) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    // Fetch delivery logs summary
    const logs = await query<{
      status: string;
      count: number;
    }[]>(
      `SELECT status, COUNT(*) as count
       FROM push_notification_logs
       WHERE notification_id = ?
       GROUP BY status`,
      [notifId]
    );

    // Fetch recent logs (last 20 recipients)
    const recentLogs = await query<{
      id: number;
      recipient_type: string;
      recipient_id: number;
      recipient_name: string | null;
      status: string;
      error_message: string | null;
      sent_at: string | null;
    }[]>(
      `SELECT id, recipient_type, recipient_id, recipient_name, status, error_message, sent_at
       FROM push_notification_logs
       WHERE notification_id = ?
       ORDER BY id DESC
       LIMIT 20`,
      [notifId]
    );

    return NextResponse.json({
      notification: {
        ...notif,
        audience_filters: (() => {
          try { return JSON.parse(notif.audience_filters || '{}'); } catch { return {}; }
        })(),
        channels: (() => {
          try { return JSON.parse(notif.channels || '["push"]'); } catch { return ['push']; }
        })(),
      },
      delivery_summary: logs,
      recent_logs: recentLogs,
    });
  } catch (err) {
    console.error('push-notifications [id] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
