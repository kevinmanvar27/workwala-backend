import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';

// GET /api/admin/coupons/[id] — full coupon detail with usage stats
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission(req, 'coupons.view');
  if (error) return error;

  try {
    const { id } = await params;

    const rows = await query<any[]>(
      `SELECT c.*,
              (SELECT COUNT(*) FROM coupon_usages cu WHERE cu.coupon_id = c.id AND cu.usage_status = 'applied') AS confirmed_usage
       FROM coupons c
       WHERE c.id = ? AND c.deleted_at IS NULL`,
      [id]
    );

    if (rows.length === 0) return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });

    const coupon = rows[0];

    // Parse JSON fields
    for (const f of ['applicable_categories', 'applicable_partners', 'applicable_cities', 'applicable_services', 'audience_filters']) {
      if (typeof coupon[f] === 'string') {
        try { coupon[f] = JSON.parse(coupon[f]); } catch { coupon[f] = null; }
      }
    }

    // Remaining usage
    coupon.remaining_usage = coupon.max_total_usage != null
      ? Math.max(0, coupon.max_total_usage - coupon.current_usage)
      : null;

    // Specific eligible users (if audience_type = specific_users)
    if (coupon.audience_type === 'specific_users') {
      const eligible = await query<{ customer_id: number }[]>(
        'SELECT customer_id FROM coupon_user_eligibility WHERE coupon_id = ?',
        [id]
      );
      coupon.specific_user_ids = eligible.map((r) => r.customer_id);
    }

    // Recent audit logs
    const auditLogs = await query<any[]>(
      `SELECT id, action, performed_by_name, changes, ip_address, created_at
       FROM coupon_audit_logs
       WHERE coupon_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [id]
    );

    return NextResponse.json({ success: true, coupon, audit_logs: auditLogs });
  } catch (err) {
    console.error('coupon GET [id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
