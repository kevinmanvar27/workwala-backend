import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';

// GET /api/admin/coupons/analytics — coupon performance dashboard data
export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, 'coupons.usage');
  if (error) return error;

  try {
    // Overview stats
    const [overview] = await query<any[]>(`
      SELECT
        COUNT(*)                                                   AS total_coupons,
        SUM(status = 'active')                                     AS active_coupons,
        SUM(status = 'scheduled')                                  AS scheduled_coupons,
        SUM(status = 'expired')                                    AS expired_coupons,
        SUM(status = 'draft')                                      AS draft_coupons,
        SUM(status = 'deactivated')                                AS deactivated_coupons,
        SUM(status = 'exhausted')                                  AS exhausted_coupons,
        COALESCE(SUM(current_usage), 0)                            AS total_usage
      FROM coupons WHERE deleted_at IS NULL
    `);

    // Total discount given
    const [discountStats] = await query<any[]>(`
      SELECT
        COALESCE(SUM(discount_amount), 0)  AS total_discount_given,
        COALESCE(SUM(order_amount), 0)     AS total_order_value,
        COUNT(*)                           AS total_uses,
        COUNT(DISTINCT customer_id)        AS unique_users
      FROM coupon_usages WHERE usage_status = 'applied'
    `);

    // Top 5 most used coupons
    const topCoupons = await query<any[]>(`
      SELECT c.id, c.code, c.name, c.discount_type, c.discount_value,
             c.current_usage, c.max_total_usage, c.status,
             COALESCE(SUM(cu.discount_amount), 0) AS total_discount
      FROM coupons c
      LEFT JOIN coupon_usages cu ON cu.coupon_id = c.id AND cu.usage_status = 'applied'
      WHERE c.deleted_at IS NULL
      GROUP BY c.id
      ORDER BY c.current_usage DESC
      LIMIT 5
    `);

    // Usage trend — last 30 days
    const usageTrend = await query<any[]>(`
      SELECT DATE(used_at) AS date, COUNT(*) AS uses, COALESCE(SUM(discount_amount), 0) AS discount
      FROM coupon_usages
      WHERE usage_status = 'applied' AND used_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(used_at)
      ORDER BY date ASC
    `);

    // Coupons expiring soon (next 7 days)
    const expiringSoon = await query<any[]>(`
      SELECT id, code, name, expires_at, current_usage, max_total_usage, status
      FROM coupons
      WHERE deleted_at IS NULL
        AND status = 'active'
        AND expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)
      ORDER BY expires_at ASC
      LIMIT 5
    `);

    return NextResponse.json({
      success: true,
      overview: { ...overview, ...discountStats },
      top_coupons: topCoupons,
      usage_trend: usageTrend,
      expiring_soon: expiringSoon,
    });
  } catch (err) {
    console.error('coupons analytics error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
