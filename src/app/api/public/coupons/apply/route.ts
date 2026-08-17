import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';

// POST /api/public/coupons/apply
// Records coupon usage after an order is confirmed.
// Uses SELECT ... FOR UPDATE to prevent race conditions on usage limits.
export async function POST(req: NextRequest) {
  try {
    // Require a valid customer or partner JWT — prevents anonymous coupon exhaustion
    const { error: authError, user: caller } = await requireMobileAuth(req, 'customer');
    if (authError) return authError;

    const body = await req.json();
    const {
      code, customer_name, customer_phone,
      order_id, order_amount, discount_amount,
      partner_id, partner_name, city,
    } = body;

    // customer_id is always taken from the verified JWT — never trusted from the body
    const customer_id = caller.userId;

    if (!code || !customer_id || !order_id) {
      return NextResponse.json({ success: false, error: 'code, customer_id, and order_id are required' }, { status: 400 });
    }

    const normalizedCode = String(code).toUpperCase().trim();

    // Use a transaction to safely increment usage counter
    const conn = await (await import('@/lib/db')).default.getConnection();
    try {
      await conn.beginTransaction();

      // Lock the coupon row
      const [rows] = await conn.execute(
        'SELECT id, status, max_total_usage, current_usage, max_usage_per_user FROM coupons WHERE code = ? AND deleted_at IS NULL FOR UPDATE',
        [normalizedCode]
      ) as [any[], any];

      if (rows.length === 0) {
        await conn.rollback();
        return NextResponse.json({ success: false, error: 'Coupon not found' });
      }

      const coupon = rows[0];

      // Re-validate limits under lock
      if (coupon.status !== 'active') {
        await conn.rollback();
        return NextResponse.json({ success: false, error: 'Coupon is no longer active' });
      }

      if (coupon.max_total_usage !== null && coupon.current_usage >= coupon.max_total_usage) {
        await conn.execute("UPDATE coupons SET status = 'exhausted' WHERE id = ?", [coupon.id]);
        await conn.commit();
        return NextResponse.json({ success: false, error: 'Coupon usage limit reached' });
      }

      // Check per-user limit
      const [userRows] = await conn.execute(
        "SELECT COUNT(*) AS cnt FROM coupon_usages WHERE coupon_id = ? AND customer_id = ? AND usage_status = 'applied'",
        [coupon.id, customer_id]
      ) as [any[], any];

      if (userRows[0].cnt >= coupon.max_usage_per_user) {
        await conn.rollback();
        return NextResponse.json({ success: false, error: 'Per-user usage limit reached' });
      }

      // Record usage
      await conn.execute(
        `INSERT INTO coupon_usages
           (coupon_id, coupon_code, customer_id, customer_name, customer_phone,
            order_id, order_amount, discount_amount, partner_id, partner_name, city, usage_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'applied')`,
        [
          coupon.id, normalizedCode, customer_id,
          customer_name || '', customer_phone || '',
          order_id, parseFloat(order_amount) || 0,
          parseFloat(discount_amount) || 0,
          partner_id || null, partner_name || null, city || null,
        ]
      );

      // Increment usage counter
      const newUsage = coupon.current_usage + 1;
      const newStatus = coupon.max_total_usage !== null && newUsage >= coupon.max_total_usage
        ? 'exhausted'
        : 'active';

      await conn.execute(
        'UPDATE coupons SET current_usage = ?, status = ? WHERE id = ?',
        [newUsage, newStatus, coupon.id]
      );

      await conn.commit();
      return NextResponse.json({ success: true, message: 'Coupon usage recorded' });
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('coupon apply error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
