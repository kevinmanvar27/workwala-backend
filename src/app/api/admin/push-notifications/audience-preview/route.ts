import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';

/**
 * POST /api/admin/push-notifications/audience-preview
 * Returns estimated recipient count and a sample of recipient names
 * based on the provided audience filters.
 *
 * Body: { audience_type, audience_filters }
 */
export async function POST(req: NextRequest) {
  const { error } = await requirePermission(req, 'notifications.view');
  if (error) return error;

  try {
    const body = await req.json();
    const { audience_type, audience_filters } = body as {
      audience_type: string;
      audience_filters: Record<string, unknown>;
    };

    const filters = audience_filters || {};

    // Build the recipient query based on audience_type and filters
    // We query partners + customers (the two FCM-token-bearing tables)
    const result = await buildAudienceQuery(audience_type, filters);

    return NextResponse.json({
      success: true,
      estimated_count: result.count,
      sample: result.sample,
    });
  } catch (err) {
    console.error('audience-preview POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

interface AudienceResult {
  count: number;
  sample: { id: number; name: string; type: 'partner' | 'customer' | 'user' }[];
}

async function buildAudienceQuery(
  audienceType: string,
  filters: Record<string, unknown>
): Promise<AudienceResult> {
  const sample: AudienceResult['sample'] = [];
  let count = 0;

  // ── ALL ──────────────────────────────────────────────────────────────────
  if (audienceType === 'all') {
    const [partnerCount] = await query<{ c: number }[]>(
      `SELECT COUNT(*) as c FROM partners WHERE deleted_at IS NULL AND fcm_token IS NOT NULL AND fcm_token != ''`
    );
    const [customerCount] = await query<{ c: number }[]>(
      `SELECT COUNT(*) as c FROM customers WHERE deleted_at IS NULL AND fcm_token IS NOT NULL AND fcm_token != ''`
    );
    count = (partnerCount?.c ?? 0) + (customerCount?.c ?? 0);

    const partnerSample = await query<{ id: number; name: string }[]>(
      `SELECT id, COALESCE(name, phone) as name FROM partners
       WHERE deleted_at IS NULL AND fcm_token IS NOT NULL AND fcm_token != ''
       LIMIT 5`
    );
    partnerSample.forEach((r) => sample.push({ ...r, type: 'partner' }));

    if (sample.length < 5) {
      const customerSample = await query<{ id: number; name: string }[]>(
        `SELECT id, COALESCE(name, phone) as name FROM customers
         WHERE deleted_at IS NULL AND fcm_token IS NOT NULL AND fcm_token != ''
         LIMIT ?`,
        [5 - sample.length]
      );
      customerSample.forEach((r) => sample.push({ ...r, type: 'customer' }));
    }
    return { count, sample };
  }

  // ── PARTNER ──────────────────────────────────────────────────────────────
  if (audienceType === 'partner') {
    const partnerIds = filters.partner_ids as number[] | undefined;
    if (partnerIds && partnerIds.length > 0) {
      const placeholders = partnerIds.map(() => '?').join(',');
      const [cnt] = await query<{ c: number }[]>(
        `SELECT COUNT(*) as c FROM partners
         WHERE id IN (${placeholders}) AND deleted_at IS NULL AND fcm_token IS NOT NULL AND fcm_token != ''`,
        partnerIds
      );
      count = cnt?.c ?? 0;
      const rows = await query<{ id: number; name: string }[]>(
        `SELECT id, COALESCE(name, phone) as name FROM partners
         WHERE id IN (${placeholders}) AND deleted_at IS NULL AND fcm_token IS NOT NULL AND fcm_token != ''
         LIMIT 5`,
        partnerIds
      );
      rows.forEach((r) => sample.push({ ...r, type: 'partner' }));
    } else {
      // All partners with FCM token
      const [cnt] = await query<{ c: number }[]>(
        `SELECT COUNT(*) as c FROM partners WHERE deleted_at IS NULL AND fcm_token IS NOT NULL AND fcm_token != ''`
      );
      count = cnt?.c ?? 0;
      const rows = await query<{ id: number; name: string }[]>(
        `SELECT id, COALESCE(name, phone) as name FROM partners
         WHERE deleted_at IS NULL AND fcm_token IS NOT NULL AND fcm_token != ''
         LIMIT 5`
      );
      rows.forEach((r) => sample.push({ ...r, type: 'partner' }));
    }
    return { count, sample };
  }

  // ── PARTNER_TYPE ─────────────────────────────────────────────────────────
  if (audienceType === 'partner_type') {
    const partnerStatus = (filters.partner_status as string) || 'approved';
    const [cnt] = await query<{ c: number }[]>(
      `SELECT COUNT(*) as c FROM partners
       WHERE status = ? AND deleted_at IS NULL AND fcm_token IS NOT NULL AND fcm_token != ''`,
      [partnerStatus]
    );
    count = cnt?.c ?? 0;
    const rows = await query<{ id: number; name: string }[]>(
      `SELECT id, COALESCE(name, phone) as name FROM partners
       WHERE status = ? AND deleted_at IS NULL AND fcm_token IS NOT NULL AND fcm_token != ''
       LIMIT 5`,
      [partnerStatus]
    );
    rows.forEach((r) => sample.push({ ...r, type: 'partner' }));
    return { count, sample };
  }

  // ── SPECIFIC_USER ─────────────────────────────────────────────────────────
  if (audienceType === 'specific_user') {
    const userIds = filters.user_ids as number[] | undefined;
    if (userIds && userIds.length > 0) {
      // Check customers table
      const placeholders = userIds.map(() => '?').join(',');
      const [cnt] = await query<{ c: number }[]>(
        `SELECT COUNT(*) as c FROM customers
         WHERE id IN (${placeholders}) AND deleted_at IS NULL AND fcm_token IS NOT NULL AND fcm_token != ''`,
        userIds
      );
      count = cnt?.c ?? 0;
      const rows = await query<{ id: number; name: string }[]>(
        `SELECT id, COALESCE(name, phone) as name FROM customers
         WHERE id IN (${placeholders}) AND deleted_at IS NULL AND fcm_token IS NOT NULL AND fcm_token != ''
         LIMIT 5`,
        userIds
      );
      rows.forEach((r) => sample.push({ ...r, type: 'customer' }));
    }
    return { count, sample };
  }

  // ── CATEGORY (service/work category) ─────────────────────────────────────
  if (audienceType === 'category') {
    const categoryIds = filters.category_ids as string[] | undefined;
    if (categoryIds && categoryIds.length > 0) {
      // Partners who have these categories in their JSON array
      const rows = await query<{ id: number; name: string; categories: string }[]>(
        `SELECT id, COALESCE(name, phone) as name, categories FROM partners
         WHERE deleted_at IS NULL AND fcm_token IS NOT NULL AND fcm_token != ''`
      );
      const matched = rows.filter((r) => {
        try {
          const cats: string[] = JSON.parse(r.categories || '[]');
          return cats.some((c) => categoryIds.includes(c));
        } catch { return false; }
      });
      count = matched.length;
      matched.slice(0, 5).forEach((r) => sample.push({ id: r.id, name: r.name, type: 'partner' }));
    }
    return { count, sample };
  }

  // ── ROLE ──────────────────────────────────────────────────────────────────
  if (audienceType === 'role') {
    const roleIds = filters.role_ids as number[] | undefined;
    if (roleIds && roleIds.length > 0) {
      const placeholders = roleIds.map(() => '?').join(',');
      // Admin users with FCM tokens are not tracked yet — return count from users table
      const [cnt] = await query<{ c: number }[]>(
        `SELECT COUNT(*) as c FROM users
         WHERE role_id IN (${placeholders}) AND deleted_at IS NULL`,
        roleIds
      );
      count = cnt?.c ?? 0;
      const rows = await query<{ id: number; name: string }[]>(
        `SELECT id, name FROM users
         WHERE role_id IN (${placeholders}) AND deleted_at IS NULL
         LIMIT 5`,
        roleIds
      );
      rows.forEach((r) => sample.push({ ...r, type: 'user' }));
    }
    return { count, sample };
  }

  // ── CUSTOM (combinable filters) ───────────────────────────────────────────
  if (audienceType === 'custom') {
    // Combine partner + customer queries based on sub-filters
    let partnerCount = 0;
    let customerCount = 0;

    const partnerWhere: string[] = ['p.deleted_at IS NULL', "p.fcm_token IS NOT NULL", "p.fcm_token != ''"];
    const partnerParams: (string | number)[] = [];

    if (filters.partner_status) {
      partnerWhere.push('p.status = ?');
      partnerParams.push(filters.partner_status as string);
    }
    if (filters.include_partners !== false) {
      const [cnt] = await query<{ c: number }[]>(
        `SELECT COUNT(*) as c FROM partners p WHERE ${partnerWhere.join(' AND ')}`,
        partnerParams
      );
      partnerCount = cnt?.c ?? 0;
    }

    const customerWhere: string[] = ['c.deleted_at IS NULL', "c.fcm_token IS NOT NULL", "c.fcm_token != ''"];
    const customerParams: (string | number)[] = [];

    if (filters.include_customers !== false) {
      const [cnt] = await query<{ c: number }[]>(
        `SELECT COUNT(*) as c FROM customers c WHERE ${customerWhere.join(' AND ')}`,
        customerParams
      );
      customerCount = cnt?.c ?? 0;
    }

    count = partnerCount + customerCount;

    if (filters.include_partners !== false) {
      const rows = await query<{ id: number; name: string }[]>(
        `SELECT id, COALESCE(name, phone) as name FROM partners p
         WHERE ${partnerWhere.join(' AND ')} LIMIT 3`,
        partnerParams
      );
      rows.forEach((r) => sample.push({ ...r, type: 'partner' }));
    }
    if (filters.include_customers !== false) {
      const rows = await query<{ id: number; name: string }[]>(
        `SELECT id, COALESCE(name, phone) as name FROM customers c
         WHERE ${customerWhere.join(' AND ')} LIMIT 3`,
        customerParams
      );
      rows.forEach((r) => sample.push({ ...r, type: 'customer' }));
    }

    return { count, sample };
  }

  return { count: 0, sample: [] };
}
