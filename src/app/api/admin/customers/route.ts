import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { logActivity, getClientIp } from '@/lib/activityLogger';

// GET /api/admin/customers — list customers with search + pagination + deleted tab
export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, 'users.view');
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const search  = searchParams.get('search')  || '';
    const page    = parseInt(searchParams.get('page')    || '1');
    const limit   = parseInt(searchParams.get('limit')   || '10');
    const deleted = searchParams.get('deleted') === '1';
    const offset  = (page - 1) * limit;

    const searchWild = `%${search}%`;
    const deletedFilter = deleted ? 'AND c.deleted_at IS NOT NULL' : 'AND c.deleted_at IS NULL';

    const customers = await query<{
      id: number;
      name: string | null;
      phone: string;
      fcm_token: string | null;
      created_at: string;
      deleted_at: string | null;
      total_bookings: number;
    }[]>(
      `SELECT
         c.id,
         c.name,
         c.phone,
         c.fcm_token,
         c.created_at,
         c.deleted_at,
         COUNT(b.id) AS total_bookings
       FROM customers c
       LEFT JOIN bookings b ON b.customer_id = c.id AND b.deleted_at IS NULL
       WHERE (c.name LIKE ? OR c.phone LIKE ?)
         ${deletedFilter}
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [searchWild, searchWild, limit, offset]
    );

    const [total] = await query<{ count: number }[]>(
      `SELECT COUNT(*) as count
       FROM customers c
       WHERE (c.name LIKE ? OR c.phone LIKE ?)
         ${deletedFilter}`,
      [searchWild, searchWild]
    );

    return NextResponse.json({ customers, total: total.count, page, limit });
  } catch (err) {
    console.error('Customers GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/admin/customers — edit name/phone, soft-delete, or restore
export async function PATCH(req: NextRequest) {
  const { error, user: actor } = await requirePermission(req, 'users.view');
  if (error) return error;

  try {
    const body = await req.json();
    const { id, action, name, phone } = body;

    if (!id) return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });

    const [existing] = await query<{ id: number; name: string | null; phone: string; deleted_at: string | null }[]>(
      `SELECT id, name, phone, deleted_at FROM customers WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!existing) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    if (action === 'delete') {
      // Soft-delete
      await query(`UPDATE customers SET deleted_at = NOW() WHERE id = ?`, [id]);
      await logActivity({
        userId: actor.userId, userName: actor.email,
        action: 'delete', module: 'customers',
        targetId: id, targetName: existing.name || existing.phone,
        description: `Soft-deleted customer "${existing.name || existing.phone}"`,
        ipAddress: getClientIp(req),
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'restore') {
      await query(`UPDATE customers SET deleted_at = NULL WHERE id = ?`, [id]);
      await logActivity({
        userId: actor.userId, userName: actor.email,
        action: 'restore', module: 'customers',
        targetId: id, targetName: existing.name || existing.phone,
        description: `Restored customer "${existing.name || existing.phone}"`,
        ipAddress: getClientIp(req),
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'edit') {
      const updates: string[] = [];
      const params: (string | number)[] = [];

      if (name !== undefined) {
        const trimmed = name?.toString().trim() || null;
        updates.push('name = ?');
        params.push(trimmed ?? '');
      }

      if (phone !== undefined) {
        const cleanPhone = phone.toString().replace(/\D/g, '').slice(-10);
        if (cleanPhone.length !== 10) {
          return NextResponse.json({ error: 'A valid 10-digit phone number is required' }, { status: 400 });
        }
        // Check duplicate phone (excluding self)
        const [dup] = await query<{ id: number }[]>(
          `SELECT id FROM customers WHERE phone = ? AND id != ? AND deleted_at IS NULL LIMIT 1`,
          [cleanPhone, id]
        );
        if (dup) return NextResponse.json({ error: 'Phone number already in use by another customer' }, { status: 409 });
        updates.push('phone = ?');
        params.push(cleanPhone);
      }

      if (updates.length === 0) {
        return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
      }

      params.push(id);
      await query(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`, params);

      await logActivity({
        userId: actor.userId, userName: actor.email,
        action: 'update', module: 'customers',
        targetId: id, targetName: existing.name || existing.phone,
        description: `Updated customer "${existing.name || existing.phone}"`,
        ipAddress: getClientIp(req),
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('Customers PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
