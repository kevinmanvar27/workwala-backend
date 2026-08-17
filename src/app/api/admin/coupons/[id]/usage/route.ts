import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';

// GET /api/admin/coupons/[id]/usage — paginated usage history for a coupon
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission(req, 'coupons.usage');
  if (error) return error;

  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const page  = parseInt(searchParams.get('page')  || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const usages = await query<any[]>(
      `SELECT cu.id, cu.coupon_code, cu.customer_id, cu.customer_name, cu.customer_phone,
              cu.order_id, cu.order_amount, cu.discount_amount, cu.partner_name,
              cu.city, cu.usage_status, cu.used_at
       FROM coupon_usages cu
       WHERE cu.coupon_id = ?
       ORDER BY cu.used_at DESC
       LIMIT ? OFFSET ?`,
      [id, limit, offset]
    );

    const [{ count }] = await query<{ count: number }[]>(
      'SELECT COUNT(*) as count FROM coupon_usages WHERE coupon_id = ?',
      [id]
    );

    // Aggregate stats
    const [stats] = await query<any[]>(
      `SELECT
         COUNT(*) AS total_uses,
         COALESCE(SUM(discount_amount), 0) AS total_discount,
         COALESCE(SUM(order_amount), 0) AS total_order_value,
         COUNT(DISTINCT customer_id) AS unique_users
       FROM coupon_usages
       WHERE coupon_id = ? AND usage_status = 'applied'`,
      [id]
    );

    return NextResponse.json({ success: true, usages, total: count, page, limit, stats });
  } catch (err) {
    console.error('coupon usage GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
