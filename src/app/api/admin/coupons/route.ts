import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { query } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import { logActivity, getClientIp } from '@/lib/activityLogger';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Generates a cryptographically secure random coupon code using CSPRNG.
function generateCode(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[randomInt(0, chars.length)];
  }
  return code;
}

async function isCodeUnique(code: string, excludeId?: number): Promise<boolean> {
  const rows = await query<{ id: number }[]>(
    `SELECT id FROM coupons WHERE code = ? AND deleted_at IS NULL${excludeId ? ' AND id != ?' : ''}`,
    excludeId ? [code, excludeId] : [code]
  );
  return rows.length === 0;
}

function resolveStatus(starts_at: string, expires_at: string, currentStatus: string): string {
  if (['deactivated', 'draft', 'exhausted'].includes(currentStatus)) return currentStatus;
  const now = new Date();
  const start = new Date(starts_at);
  const end = new Date(expires_at);
  if (now > end) return 'expired';
  if (now >= start && now <= end) return 'active';
  if (now < start) return 'scheduled';
  return currentStatus;
}

async function insertAuditLog(opts: {
  couponId: number;
  couponCode: string;
  action: string;
  performedBy: number | null;
  performedByName: string;
  changes?: object | null;
  ipAddress?: string | null;
}) {
  try {
    await query(
      `INSERT INTO coupon_audit_logs (coupon_id, coupon_code, action, performed_by, performed_by_name, changes, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        opts.couponId,
        opts.couponCode,
        opts.action,
        opts.performedBy ?? null,
        opts.performedByName,
        opts.changes ? JSON.stringify(opts.changes) : null,
        opts.ipAddress ?? null,
      ]
    );
  } catch { /* silent */ }
}

// ─── GET /api/admin/coupons ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { error, user } = await requirePermission(req, 'coupons.view');
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const search   = searchParams.get('search')   || '';
    const status   = searchParams.get('status')   || 'all';
    const category = searchParams.get('category') || 'all';
    const page     = parseInt(searchParams.get('page')  || '1');
    const limit    = parseInt(searchParams.get('limit') || '15');
    const sort     = searchParams.get('sort')     || 'created_at';
    const dir      = searchParams.get('dir')      === 'asc' ? 'ASC' : 'DESC';
    const offset   = (page - 1) * limit;

    const allowed = ['created_at', 'expires_at', 'starts_at', 'current_usage', 'code', 'name'];
    const safeSort = allowed.includes(sort) ? sort : 'created_at';

    const conditions: string[] = ['c.deleted_at IS NULL'];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push('(c.code LIKE ? OR c.name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (status !== 'all') {
      conditions.push('c.status = ?');
      params.push(status);
    }
    if (category !== 'all') {
      conditions.push('JSON_CONTAINS(c.applicable_categories, JSON_QUOTE(?))');
      params.push(category);
    }

    const where = conditions.join(' AND ');

    const coupons = await query<any[]>(
      `SELECT c.id, c.code, c.name, c.description, c.discount_type, c.discount_value,
              c.min_order_value, c.max_discount_amount, c.max_total_usage, c.max_usage_per_user,
              c.current_usage, c.status, c.starts_at, c.expires_at, c.audience_type,
              c.applicable_categories, c.applicable_partners, c.applicable_cities,
              c.created_by, c.created_by_name, c.created_at, c.updated_at
       FROM coupons c
       WHERE ${where}
       ORDER BY c.${safeSort} ${dir}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [{ count }] = await query<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM coupons c WHERE ${where}`,
      params
    );

    // Auto-update statuses that have changed due to time
    for (const c of coupons) {
      const computed = resolveStatus(c.starts_at, c.expires_at, c.status);
      if (computed !== c.status) {
        await query('UPDATE coupons SET status = ? WHERE id = ?', [computed, c.id]);
        c.status = computed;
      }
    }

    return NextResponse.json({ success: true, coupons, total: count, page, limit });
  } catch (err) {
    console.error('coupons GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/admin/coupons — create ────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { error, user } = await requirePermission(req, 'coupons.create');
  if (error) return error;

  try {
    const body = await req.json();
    const {
      code: rawCode, auto_generate, code_length,
      name, description, terms_conditions,
      discount_type, discount_value,
      min_order_value, max_discount_amount,
      max_total_usage, max_usage_per_user,
      once_per_order, combinable,
      starts_at, expires_at, status: reqStatus,
      applicable_categories, applicable_partners,
      applicable_cities, applicable_services,
      audience_type, audience_filters,
      specific_user_ids,
    } = body;

    // Validate required fields
    if (!name?.trim()) return NextResponse.json({ error: 'Coupon name is required' }, { status: 400 });
    if (!discount_type) return NextResponse.json({ error: 'Discount type is required' }, { status: 400 });
    if (discount_value === undefined || discount_value === null || isNaN(Number(discount_value))) {
      return NextResponse.json({ error: 'Discount value is required' }, { status: 400 });
    }
    if (discount_type === 'percentage' && (Number(discount_value) <= 0 || Number(discount_value) > 100)) {
      return NextResponse.json({ error: 'Percentage discount must be between 1 and 100' }, { status: 400 });
    }
    if (!starts_at || !expires_at) {
      return NextResponse.json({ error: 'Start date and expiry date are required' }, { status: 400 });
    }
    if (new Date(expires_at) <= new Date(starts_at)) {
      return NextResponse.json({ error: 'Expiry date must be after start date' }, { status: 400 });
    }

    // Resolve coupon code
    let code: string;
    if (auto_generate) {
      const len = Math.min(Math.max(parseInt(code_length) || 8, 4), 20);
      let attempts = 0;
      do {
        code = generateCode(len);
        attempts++;
        if (attempts > 20) return NextResponse.json({ error: 'Could not generate a unique code' }, { status: 500 });
      } while (!(await isCodeUnique(code)));
    } else {
      if (!rawCode?.trim()) return NextResponse.json({ error: 'Coupon code is required' }, { status: 400 });
      code = rawCode.trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,50}$/.test(code)) {
        return NextResponse.json({ error: 'Code must be 3–50 alphanumeric characters (A-Z, 0-9, _, -)' }, { status: 400 });
      }
      if (!(await isCodeUnique(code))) {
        return NextResponse.json({ error: 'This coupon code already exists' }, { status: 409 });
      }
    }

    // Determine initial status
    const now = new Date();
    const startDate = new Date(starts_at);
    let initialStatus = reqStatus || 'draft';
    if (initialStatus === 'active' || initialStatus === 'scheduled') {
      initialStatus = resolveStatus(starts_at, expires_at, initialStatus);
    }

    const result = await query<{ insertId: number }>(
      `INSERT INTO coupons
         (code, name, description, terms_conditions, discount_type, discount_value,
          min_order_value, max_discount_amount, max_total_usage, max_usage_per_user,
          once_per_order, combinable, starts_at, expires_at, status,
          applicable_categories, applicable_partners, applicable_cities, applicable_services,
          audience_type, audience_filters, created_by, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code,
        name.trim(),
        description?.trim() || null,
        terms_conditions?.trim() || null,
        discount_type,
        parseFloat(discount_value),
        parseFloat(min_order_value) || 0,
        max_discount_amount ? parseFloat(max_discount_amount) : null,
        max_total_usage ? parseInt(max_total_usage) : null,
        parseInt(max_usage_per_user) || 1,
        once_per_order === false ? 0 : 1,
        combinable ? 1 : 0,
        starts_at,
        expires_at,
        initialStatus,
        applicable_categories ? JSON.stringify(applicable_categories) : null,
        applicable_partners   ? JSON.stringify(applicable_partners)   : null,
        applicable_cities     ? JSON.stringify(applicable_cities)     : null,
        applicable_services   ? JSON.stringify(applicable_services)   : null,
        audience_type || 'all',
        audience_filters ? JSON.stringify(audience_filters) : null,
        user!.userId,
        user!.email,
      ]
    );

    const couponId = result.insertId;

    // Insert specific user eligibility rows
    if (audience_type === 'specific_users' && Array.isArray(specific_user_ids) && specific_user_ids.length > 0) {
      for (const uid of specific_user_ids) {
        await query(
          'INSERT IGNORE INTO coupon_user_eligibility (coupon_id, customer_id) VALUES (?, ?)',
          [couponId, uid]
        ).catch(() => {});
      }
    }

    // Audit log
    await insertAuditLog({
      couponId,
      couponCode: code,
      action: 'created',
      performedBy: user!.userId,
      performedByName: user!.email,
      ipAddress: getClientIp(req),
    });

    await logActivity({
      userId: user!.userId,
      userName: user!.email,
      action: 'Created',
      module: 'coupons',
      targetId: couponId,
      targetName: code,
      description: `Created coupon "${name}" (${code})`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true, id: couponId, code }, { status: 201 });
  } catch (err) {
    console.error('coupons POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH /api/admin/coupons — update ───────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const { error, user } = await requirePermission(req, 'coupons.edit');
  if (error) return error;

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const existing = await query<any[]>(
      'SELECT * FROM coupons WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (existing.length === 0) return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });

    const before = existing[0];

    // Cannot edit exhausted or expired coupons (only deactivate/reactivate)
    if (['expired', 'exhausted'].includes(before.status) && !updates.status) {
      return NextResponse.json({ error: 'Cannot edit an expired or exhausted coupon' }, { status: 400 });
    }

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const setField = (col: string, val: string | number | null) => {
      fields.push(`${col} = ?`);
      values.push(val);
    };

    if (updates.name !== undefined) setField('name', updates.name.trim());
    if (updates.description !== undefined) setField('description', updates.description?.trim() || null);
    if (updates.terms_conditions !== undefined) setField('terms_conditions', updates.terms_conditions?.trim() || null);
    if (updates.discount_type !== undefined) setField('discount_type', updates.discount_type);
    if (updates.discount_value !== undefined) setField('discount_value', parseFloat(updates.discount_value));
    if (updates.min_order_value !== undefined) setField('min_order_value', parseFloat(updates.min_order_value) || 0);
    if (updates.max_discount_amount !== undefined) setField('max_discount_amount', updates.max_discount_amount ? parseFloat(updates.max_discount_amount) : null);
    if (updates.max_total_usage !== undefined) setField('max_total_usage', updates.max_total_usage ? parseInt(updates.max_total_usage) : null);
    if (updates.max_usage_per_user !== undefined) setField('max_usage_per_user', parseInt(updates.max_usage_per_user) || 1);
    if (updates.once_per_order !== undefined) setField('once_per_order', updates.once_per_order ? 1 : 0);
    if (updates.combinable !== undefined) setField('combinable', updates.combinable ? 1 : 0);
    if (updates.starts_at !== undefined) setField('starts_at', updates.starts_at);
    if (updates.expires_at !== undefined) setField('expires_at', updates.expires_at);
    if (updates.applicable_categories !== undefined) setField('applicable_categories', updates.applicable_categories ? JSON.stringify(updates.applicable_categories) : null);
    if (updates.applicable_partners !== undefined) setField('applicable_partners', updates.applicable_partners ? JSON.stringify(updates.applicable_partners) : null);
    if (updates.applicable_cities !== undefined) setField('applicable_cities', updates.applicable_cities ? JSON.stringify(updates.applicable_cities) : null);
    if (updates.applicable_services !== undefined) setField('applicable_services', updates.applicable_services ? JSON.stringify(updates.applicable_services) : null);
    if (updates.audience_type !== undefined) setField('audience_type', updates.audience_type);
    if (updates.audience_filters !== undefined) setField('audience_filters', updates.audience_filters ? JSON.stringify(updates.audience_filters) : null);

    // Status change
    if (updates.status !== undefined) {
      const newStatus = updates.status;
      const startsAt  = updates.starts_at || before.starts_at;
      const expiresAt = updates.expires_at || before.expires_at;

      // Permission checks for status transitions
      if (newStatus === 'active' || newStatus === 'scheduled') {
        const { error: permErr } = await requirePermission(req, 'coupons.activate');
        if (permErr) return permErr;
        setField('status', resolveStatus(startsAt, expiresAt, newStatus));
      } else if (newStatus === 'deactivated') {
        const { error: permErr } = await requirePermission(req, 'coupons.deactivate');
        if (permErr) return permErr;
        setField('status', 'deactivated');
      } else {
        setField('status', newStatus);
      }
    }

    if (fields.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    values.push(id);
    await query(`UPDATE coupons SET ${fields.join(', ')} WHERE id = ?`, values);

    // Update specific user eligibility
    if (updates.audience_type === 'specific_users' && Array.isArray(updates.specific_user_ids)) {
      await query('DELETE FROM coupon_user_eligibility WHERE coupon_id = ?', [id]);
      for (const uid of updates.specific_user_ids) {
        await query(
          'INSERT IGNORE INTO coupon_user_eligibility (coupon_id, customer_id) VALUES (?, ?)',
          [id, uid]
        ).catch(() => {});
      }
    }

    // Build change diff for audit
    const changedKeys = Object.keys(updates).filter((k) => k !== 'id');
    const changeSnapshot: Record<string, { before: unknown; after: unknown }> = {};
    for (const key of changedKeys) {
      if (before[key] !== undefined) {
        changeSnapshot[key] = { before: before[key], after: updates[key] };
      }
    }

    await insertAuditLog({
      couponId: id,
      couponCode: before.code,
      action: updates.status === 'deactivated' ? 'deactivated'
            : (updates.status === 'active' || updates.status === 'scheduled') ? 'activated'
            : 'updated',
      performedBy: user!.userId,
      performedByName: user!.email,
      changes: changeSnapshot,
      ipAddress: getClientIp(req),
    });

    await logActivity({
      userId: user!.userId,
      userName: user!.email,
      action: 'Updated',
      module: 'coupons',
      targetId: id,
      targetName: before.code,
      description: `Updated coupon "${before.name}" (${before.code})`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('coupons PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE /api/admin/coupons — soft delete ──────────────────────────────────

export async function DELETE(req: NextRequest) {
  const { error, user } = await requirePermission(req, 'coupons.delete');
  if (error) return error;

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const rows = await query<any[]>(
      'SELECT id, code, name, status FROM coupons WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });

    const coupon = rows[0];
    if (coupon.status === 'active') {
      return NextResponse.json({ error: 'Cannot delete an active coupon. Deactivate it first.' }, { status: 400 });
    }

    await query('UPDATE coupons SET deleted_at = NOW() WHERE id = ?', [id]);

    await insertAuditLog({
      couponId: id,
      couponCode: coupon.code,
      action: 'deleted',
      performedBy: user!.userId,
      performedByName: user!.email,
      ipAddress: getClientIp(req),
    });

    await logActivity({
      userId: user!.userId,
      userName: user!.email,
      action: 'Deleted',
      module: 'coupons',
      targetId: id,
      targetName: coupon.code,
      description: `Deleted coupon "${coupon.name}" (${coupon.code})`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('coupons DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
