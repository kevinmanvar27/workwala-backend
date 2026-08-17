import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { logActivity, getClientIp } from '@/lib/activityLogger';

// ─── GET /api/admin/push-notifications ───────────────────────────────────────
// List notifications with pagination, search, and status filter
export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, 'notifications.view');
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';
    const categoryId = searchParams.get('category_id') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    const searchWild = `%${search}%`;
    const conditions: string[] = ['pn.deleted_at IS NULL'];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push('(pn.title LIKE ? OR pn.body LIKE ?)');
      params.push(searchWild, searchWild);
    }
    if (status !== 'all') {
      conditions.push('pn.status = ?');
      params.push(status);
    }
    if (categoryId) {
      conditions.push('pn.category_id = ?');
      params.push(parseInt(categoryId));
    }

    const where = conditions.join(' AND ');

    const notifications = await query<{
      id: number;
      title: string;
      body: string;
      category_id: number | null;
      category_name: string | null;
      category_color: string | null;
      audience_type: string;
      audience_filters: string;
      estimated_recipients: number;
      actual_recipients: number;
      delivered_count: number;
      failed_count: number;
      opened_count: number;
      priority: string;
      status: string;
      scheduled_at: string | null;
      sent_at: string | null;
      created_by_name: string | null;
      created_at: string;
    }[]>(
      `SELECT
         pn.id, pn.title, pn.body,
         pn.category_id, nc.name as category_name, nc.color as category_color,
         pn.audience_type, pn.audience_filters,
         pn.estimated_recipients, pn.actual_recipients,
         pn.delivered_count, pn.failed_count, pn.opened_count,
         pn.priority, pn.status,
         pn.scheduled_at, pn.sent_at,
         pn.created_by_name, pn.created_at
       FROM push_notifications pn
       LEFT JOIN notification_categories nc ON nc.id = pn.category_id
       WHERE ${where}
       ORDER BY pn.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [total] = await query<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM push_notifications pn WHERE ${where}`,
      params
    );

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        ...n,
        audience_filters: (() => {
          try { return JSON.parse(n.audience_filters || '{}'); } catch { return {}; }
        })(),
      })),
      total: total.count,
      page,
      limit,
    });
  } catch (err) {
    console.error('push-notifications GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/admin/push-notifications ──────────────────────────────────────
// Create a notification (draft, schedule, or send now)
export async function POST(req: NextRequest) {
  const { error, user: actor } = await requirePermission(req, 'notifications.create');
  if (error) return error;

  try {
    const body = await req.json();
    const {
      title, body: notifBody, category_id,
      image_url, action_url,
      audience_type, audience_filters,
      priority, status,
      scheduled_at, channels, notes,
      estimated_recipients,
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!notifBody?.trim()) {
      return NextResponse.json({ error: 'Message body is required' }, { status: 400 });
    }
    // Length caps — FCM title max 65 chars, body max 240 chars
    if (title.trim().length > 65) {
      return NextResponse.json({ error: 'Title must be 65 characters or fewer' }, { status: 400 });
    }
    if (notifBody.trim().length > 240) {
      return NextResponse.json({ error: 'Message body must be 240 characters or fewer' }, { status: 400 });
    }

    const VALID_STATUSES = ['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'];
    const finalStatus = VALID_STATUSES.includes(status) ? status : 'draft';

    // Validate scheduled_at when scheduling
    if (finalStatus === 'scheduled') {
      const { error: permErr } = await requirePermission(req, 'notifications.schedule');
      if (permErr) return permErr;

      if (!scheduled_at) {
        return NextResponse.json({ error: 'scheduled_at is required for scheduled notifications' }, { status: 400 });
      }
      const schedDate = new Date(scheduled_at);
      if (isNaN(schedDate.getTime()) || schedDate <= new Date()) {
        return NextResponse.json({ error: 'scheduled_at must be a future date/time' }, { status: 400 });
      }
    }

    // Validate send permission
    if (finalStatus === 'sending' || finalStatus === 'sent') {
      const { error: permErr } = await requirePermission(req, 'notifications.send');
      if (permErr) return permErr;
    }

    const result = await query<{ insertId: number }>(
      `INSERT INTO push_notifications
         (title, body, category_id, image_url, action_url,
          audience_type, audience_filters,
          estimated_recipients, priority, status,
          scheduled_at, channels, notes,
          created_by, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title.trim(),
        notifBody.trim(),
        category_id || null,
        image_url?.trim() || null,
        action_url?.trim() || null,
        audience_type || 'all',
        JSON.stringify(audience_filters || {}),
        estimated_recipients || 0,
        priority || 'normal',
        finalStatus,
        scheduled_at ? new Date(scheduled_at).toISOString().slice(0, 19).replace('T', ' ') : null,
        JSON.stringify(channels || ['push']),
        notes?.trim() || null,
        actor!.userId,
        actor!.email,
      ]
    );

    await logActivity({
      userId: actor!.userId, userName: actor!.email,
      action: finalStatus === 'draft' ? 'Saved Draft' : finalStatus === 'scheduled' ? 'Scheduled' : 'Created',
      module: 'notifications',
      targetId: result.insertId, targetName: title.trim(),
      description: `Status: ${finalStatus}`,
      ipAddress: getClientIp(req),
    });

    // If send now — trigger the actual dispatch
    if (finalStatus === 'sending') {
      // Fire-and-forget dispatch (handled by the send route)
      dispatchNotification(result.insertId, actor!.userId, actor!.email).catch(console.error);
    }

    return NextResponse.json({ success: true, id: result.insertId }, { status: 201 });
  } catch (err) {
    console.error('push-notifications POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH /api/admin/push-notifications ─────────────────────────────────────
// Update a draft or cancel a scheduled notification
export async function PATCH(req: NextRequest) {
  const { error, user: actor } = await requirePermission(req, 'notifications.create');
  if (error) return error;

  try {
    const body = await req.json();
    const { id, action, ...fields } = body;

    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const existing = await query<{
      id: number; title: string; status: string;
    }[]>(
      `SELECT id, title, status FROM push_notifications WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    const notif = existing[0];

    // ── Cancel ──────────────────────────────────────────────────────────────
    if (action === 'cancel') {
      const { error: permErr } = await requirePermission(req, 'notifications.cancel');
      if (permErr) return permErr;

      if (!['scheduled', 'draft'].includes(notif.status)) {
        return NextResponse.json(
          { error: 'Only draft or scheduled notifications can be cancelled' },
          { status: 400 }
        );
      }
      await query(
        `UPDATE push_notifications SET status = 'cancelled', updated_at = NOW() WHERE id = ?`,
        [id]
      );
      await logActivity({
        userId: actor!.userId, userName: actor!.email,
        action: 'Cancelled', module: 'notifications',
        targetId: id, targetName: notif.title,
        ipAddress: getClientIp(req),
      });
      return NextResponse.json({ success: true });
    }

    // ── Send now ─────────────────────────────────────────────────────────────
    if (action === 'send') {
      const { error: permErr } = await requirePermission(req, 'notifications.send');
      if (permErr) return permErr;

      if (!['draft', 'scheduled'].includes(notif.status)) {
        return NextResponse.json(
          { error: 'Only draft or scheduled notifications can be sent' },
          { status: 400 }
        );
      }
      await query(
        `UPDATE push_notifications SET status = 'sending', updated_at = NOW() WHERE id = ?`,
        [id]
      );
      dispatchNotification(id, actor!.userId, actor!.email).catch(console.error);
      await logActivity({
        userId: actor!.userId, userName: actor!.email,
        action: 'Sent', module: 'notifications',
        targetId: id, targetName: notif.title,
        ipAddress: getClientIp(req),
      });
      return NextResponse.json({ success: true });
    }

    // ── Edit (only drafts can be fully edited) ────────────────────────────────
    if (notif.status !== 'draft' && notif.status !== 'scheduled') {
      return NextResponse.json(
        { error: 'Only draft or scheduled notifications can be edited' },
        { status: 400 }
      );
    }

    const updateFields: string[] = [];
    const updateValues: (string | number | null)[] = [];

    if (fields.title !== undefined) {
      if (fields.title.trim().length > 65) {
        return NextResponse.json({ error: 'Title must be 65 characters or fewer' }, { status: 400 });
      }
      updateFields.push('title = ?'); updateValues.push(fields.title.trim());
    }
    if (fields.body !== undefined) {
      if (fields.body.trim().length > 240) {
        return NextResponse.json({ error: 'Message body must be 240 characters or fewer' }, { status: 400 });
      }
      updateFields.push('body = ?'); updateValues.push(fields.body.trim());
    }
    if (fields.category_id !== undefined) { updateFields.push('category_id = ?'); updateValues.push(fields.category_id || null); }
    if (fields.image_url !== undefined) { updateFields.push('image_url = ?'); updateValues.push(fields.image_url?.trim() || null); }
    if (fields.action_url !== undefined) { updateFields.push('action_url = ?'); updateValues.push(fields.action_url?.trim() || null); }
    if (fields.audience_type !== undefined) { updateFields.push('audience_type = ?'); updateValues.push(fields.audience_type); }
    if (fields.audience_filters !== undefined) { updateFields.push('audience_filters = ?'); updateValues.push(JSON.stringify(fields.audience_filters)); }
    if (fields.estimated_recipients !== undefined) { updateFields.push('estimated_recipients = ?'); updateValues.push(fields.estimated_recipients); }
    if (fields.priority !== undefined) { updateFields.push('priority = ?'); updateValues.push(fields.priority); }
    if (fields.notes !== undefined) { updateFields.push('notes = ?'); updateValues.push(fields.notes?.trim() || null); }
    if (fields.channels !== undefined) { updateFields.push('channels = ?'); updateValues.push(JSON.stringify(fields.channels)); }

    if (fields.status !== undefined) {
      const VALID_STATUSES = ['draft', 'scheduled', 'cancelled'];
      if (!VALID_STATUSES.includes(fields.status)) {
        return NextResponse.json({ error: 'Invalid status for edit' }, { status: 400 });
      }
      if (fields.status === 'scheduled') {
        const { error: permErr } = await requirePermission(req, 'notifications.schedule');
        if (permErr) return permErr;
        if (!fields.scheduled_at) {
          return NextResponse.json({ error: 'scheduled_at required when scheduling' }, { status: 400 });
        }
        const schedDate = new Date(fields.scheduled_at);
        if (isNaN(schedDate.getTime()) || schedDate <= new Date()) {
          return NextResponse.json({ error: 'scheduled_at must be a future date/time' }, { status: 400 });
        }
      }
      updateFields.push('status = ?');
      updateValues.push(fields.status);
    }

    if (fields.scheduled_at !== undefined) {
      updateFields.push('scheduled_at = ?');
      updateValues.push(
        fields.scheduled_at
          ? new Date(fields.scheduled_at).toISOString().slice(0, 19).replace('T', ' ')
          : null
      );
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    updateValues.push(id);
    await query(
      `UPDATE push_notifications SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      updateValues
    );

    await logActivity({
      userId: actor!.userId, userName: actor!.email,
      action: 'Updated', module: 'notifications',
      targetId: id, targetName: fields.title || notif.title,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('push-notifications PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE /api/admin/push-notifications ────────────────────────────────────
// Soft delete a notification (only drafts / cancelled / failed)
export async function DELETE(req: NextRequest) {
  const { error, user: actor } = await requirePermission(req, 'notifications.delete');
  if (error) return error;

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const existing = await query<{ id: number; title: string; status: string }[]>(
      `SELECT id, title, status FROM push_notifications WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    const notif = existing[0];
    const deletable = ['draft', 'cancelled', 'failed'];
    if (!deletable.includes(notif.status)) {
      return NextResponse.json(
        { error: 'Only draft, cancelled, or failed notifications can be deleted' },
        { status: 400 }
      );
    }

    await query(
      `UPDATE push_notifications SET deleted_at = NOW() WHERE id = ?`,
      [id]
    );

    await logActivity({
      userId: actor!.userId, userName: actor!.email,
      action: 'Deleted', module: 'notifications',
      targetId: id, targetName: notif.title,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('push-notifications DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── Dispatch helper ─────────────────────────────────────────────────────────
// Fetches FCM tokens for the audience and sends via Firebase.
// Updates notification status and per-recipient logs.
async function dispatchNotification(
  notifId: number,
  actorId: number,
  actorEmail: string
): Promise<void> {
  try {
    const [notif] = await query<{
      id: number; title: string; body: string;
      image_url: string | null; action_url: string | null;
      audience_type: string; audience_filters: string;
      priority: string;
    }[]>(
      `SELECT id, title, body, image_url, action_url, audience_type, audience_filters, priority
       FROM push_notifications WHERE id = ?`,
      [notifId]
    );
    if (!notif) return;

    const filters = (() => {
      try { return JSON.parse(notif.audience_filters || '{}'); } catch { return {}; }
    })();

    // Collect FCM tokens
    const recipients = await collectRecipients(notif.audience_type, filters);

    if (recipients.length === 0) {
      await query(
        `UPDATE push_notifications
         SET status = 'sent', actual_recipients = 0, sent_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [notifId]
      );
      return;
    }

    // Update actual_recipients count
    await query(
      `UPDATE push_notifications SET actual_recipients = ? WHERE id = ?`,
      [recipients.length, notifId]
    );

    // Import Firebase lazily
    const { getFirebaseMessaging, isPushEnabled } = await import('@/lib/firebase');
    const pushEnabled = await isPushEnabled();
    const messaging = pushEnabled ? await getFirebaseMessaging() : null;

    let deliveredCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      let recipientStatus: 'sent' | 'failed' = 'failed';
      let errorMsg: string | null = null;

      if (messaging && recipient.fcm_token) {
        try {
          await messaging.send({
            token: recipient.fcm_token,
            notification: {
              title: notif.title,
              body: notif.body,
              ...(notif.image_url ? { imageUrl: notif.image_url } : {}),
            },
            data: {
              ...(notif.action_url ? { action_url: notif.action_url } : {}),
              notification_id: String(notifId),
            },
            android: { priority: notif.priority === 'high' ? 'high' : 'normal' },
            apns: { payload: { aps: { sound: 'default' } } },
          });
          recipientStatus = 'sent';
          deliveredCount++;
        } catch (e: unknown) {
          errorMsg = e instanceof Error ? e.message : String(e);
          failedCount++;
        }
      } else {
        // Push not configured — log as sent (simulate)
        recipientStatus = 'sent';
        deliveredCount++;
      }

      // Log per-recipient
      await query(
        `INSERT INTO push_notification_logs
           (notification_id, recipient_type, recipient_id, recipient_name, fcm_token, status, error_message, sent_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          notifId,
          recipient.type,
          recipient.id,
          recipient.name,
          recipient.fcm_token || null,
          recipientStatus,
          errorMsg,
        ]
      );
    }

    // Mark notification as sent
    await query(
      `UPDATE push_notifications
       SET status = 'sent', delivered_count = ?, failed_count = ?, sent_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [deliveredCount, failedCount, notifId]
    );

    await logActivity({
      userId: actorId, userName: actorEmail,
      action: 'Dispatched', module: 'notifications',
      targetId: notifId,
      description: `Delivered: ${deliveredCount}, Failed: ${failedCount}`,
    });
  } catch (err) {
    console.error('dispatchNotification error:', err);
    await query(
      `UPDATE push_notifications SET status = 'failed', updated_at = NOW() WHERE id = ?`,
      [notifId]
    ).catch(() => {});
  }
}

interface Recipient {
  id: number;
  name: string;
  type: 'partner' | 'customer' | 'user';
  fcm_token: string | null;
}

async function collectRecipients(
  audienceType: string,
  filters: Record<string, unknown>
): Promise<Recipient[]> {
  const recipients: Recipient[] = [];

  if (audienceType === 'all') {
    const partners = await query<{ id: number; name: string; fcm_token: string }[]>(
      `SELECT id, COALESCE(name, phone) as name, fcm_token FROM partners
       WHERE deleted_at IS NULL AND fcm_token IS NOT NULL AND fcm_token != ''`
    );
    partners.forEach((r) => recipients.push({ ...r, type: 'partner' }));

    const customers = await query<{ id: number; name: string; fcm_token: string }[]>(
      `SELECT id, COALESCE(name, phone) as name, fcm_token FROM customers
       WHERE deleted_at IS NULL AND fcm_token IS NOT NULL AND fcm_token != ''`
    );
    customers.forEach((r) => recipients.push({ ...r, type: 'customer' }));
    return recipients;
  }

  if (audienceType === 'partner') {
    const ids = filters.partner_ids as number[] | undefined;
    const where = ids?.length
      ? `AND id IN (${ids.map(() => '?').join(',')})`
      : '';
    const params = ids?.length ? ids : [];
    const rows = await query<{ id: number; name: string; fcm_token: string }[]>(
      `SELECT id, COALESCE(name, phone) as name, fcm_token FROM partners
       WHERE deleted_at IS NULL AND fcm_token IS NOT NULL AND fcm_token != '' ${where}`,
      params
    );
    rows.forEach((r) => recipients.push({ ...r, type: 'partner' }));
    return recipients;
  }

  if (audienceType === 'partner_type') {
    const status = (filters.partner_status as string) || 'approved';
    const rows = await query<{ id: number; name: string; fcm_token: string }[]>(
      `SELECT id, COALESCE(name, phone) as name, fcm_token FROM partners
       WHERE deleted_at IS NULL AND status = ? AND fcm_token IS NOT NULL AND fcm_token != ''`,
      [status]
    );
    rows.forEach((r) => recipients.push({ ...r, type: 'partner' }));
    return recipients;
  }

  if (audienceType === 'specific_user') {
    const ids = filters.user_ids as number[] | undefined;
    if (ids?.length) {
      const placeholders = ids.map(() => '?').join(',');
      const rows = await query<{ id: number; name: string; fcm_token: string }[]>(
        `SELECT id, COALESCE(name, phone) as name, fcm_token FROM customers
         WHERE deleted_at IS NULL AND id IN (${placeholders}) AND fcm_token IS NOT NULL AND fcm_token != ''`,
        ids
      );
      rows.forEach((r) => recipients.push({ ...r, type: 'customer' }));
    }
    return recipients;
  }

  if (audienceType === 'category') {
    const categoryIds = filters.category_ids as string[] | undefined;
    if (categoryIds?.length) {
      const rows = await query<{ id: number; name: string; fcm_token: string; categories: string }[]>(
        `SELECT id, COALESCE(name, phone) as name, fcm_token, categories FROM partners
         WHERE deleted_at IS NULL AND fcm_token IS NOT NULL AND fcm_token != ''`
      );
      rows
        .filter((r) => {
          try {
            const cats: string[] = JSON.parse(r.categories || '[]');
            return cats.some((c) => categoryIds.includes(c));
          } catch { return false; }
        })
        .forEach((r) => recipients.push({ id: r.id, name: r.name, fcm_token: r.fcm_token, type: 'partner' }));
    }
    return recipients;
  }

  if (audienceType === 'custom') {
    if (filters.include_partners !== false) {
      const partnerWhere: string[] = ["fcm_token IS NOT NULL", "fcm_token != ''", 'deleted_at IS NULL'];
      const partnerParams: (string | number)[] = [];
      if (filters.partner_status) {
        partnerWhere.push('status = ?');
        partnerParams.push(filters.partner_status as string);
      }
      const rows = await query<{ id: number; name: string; fcm_token: string }[]>(
        `SELECT id, COALESCE(name, phone) as name, fcm_token FROM partners WHERE ${partnerWhere.join(' AND ')}`,
        partnerParams
      );
      rows.forEach((r) => recipients.push({ ...r, type: 'partner' }));
    }
    if (filters.include_customers !== false) {
      const rows = await query<{ id: number; name: string; fcm_token: string }[]>(
        `SELECT id, COALESCE(name, phone) as name, fcm_token FROM customers
         WHERE deleted_at IS NULL AND fcm_token IS NOT NULL AND fcm_token != ''`
      );
      rows.forEach((r) => recipients.push({ ...r, type: 'customer' }));
    }
    return recipients;
  }

  return recipients;
}
