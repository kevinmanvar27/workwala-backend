import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';

// POST /api/public/coupons/validate
// Called by the customer app to validate and apply a coupon.
// Requires a valid customer JWT — customer_id is extracted from the token,
// never trusted from the request body.
export async function POST(req: NextRequest) {
  try {
    // Require authentication — customer_id must come from the verified JWT,
    // not from the request body (prevents per-user limit bypass)
    const { error: authError, user: authPayload } = await requireMobileAuth(req, 'customer');
    if (authError) return authError;

    const body = await req.json();
    const {
      code,
      order_amount,
      category_id,
      partner_id,
      city,
      service_id,
      order_id,
    } = body;

    // Use customer_id from the verified JWT — never trust client-supplied value
    const customer_id = authPayload.userId;

    if (!code) return NextResponse.json({ valid: false, error: 'Coupon code is required' }, { status: 400 });
    if (order_amount === undefined || order_amount === null) {
      return NextResponse.json({ valid: false, error: 'Order amount is required' }, { status: 400 });
    }

    const normalizedCode = String(code).toUpperCase().trim();
    const now = new Date();

    // ── 1. Coupon exists ──────────────────────────────────────────────────────
    const coupons = await query<any[]>(
      'SELECT * FROM coupons WHERE code = ? AND deleted_at IS NULL',
      [normalizedCode]
    );
    if (coupons.length === 0) {
      return NextResponse.json({ valid: false, error: 'Invalid coupon code' });
    }
    const coupon = coupons[0];

    // Parse JSON fields
    for (const f of ['applicable_categories', 'applicable_partners', 'applicable_cities', 'applicable_services', 'audience_filters']) {
      if (typeof coupon[f] === 'string') {
        try { coupon[f] = JSON.parse(coupon[f]); } catch { coupon[f] = null; }
      }
    }

    // ── 2. Coupon is active ───────────────────────────────────────────────────
    if (coupon.status !== 'active') {
      const msg: Record<string, string> = {
        draft:       'This coupon is not yet active',
        scheduled:   'This coupon is not yet active',
        expired:     'This coupon has expired',
        deactivated: 'This coupon has been deactivated',
        exhausted:   'This coupon has reached its usage limit',
      };
      return NextResponse.json({ valid: false, error: msg[coupon.status] || 'Coupon is not active' });
    }

    // ── 3. Date validity ──────────────────────────────────────────────────────
    const startDate  = new Date(coupon.starts_at);
    const expiryDate = new Date(coupon.expires_at);
    if (now < startDate) return NextResponse.json({ valid: false, error: 'This coupon is not yet active' });
    if (now > expiryDate) {
      await query("UPDATE coupons SET status = 'expired' WHERE id = ?", [coupon.id]);
      return NextResponse.json({ valid: false, error: 'This coupon has expired' });
    }

    // ── 4. Total usage limit ──────────────────────────────────────────────────
    if (coupon.max_total_usage !== null && coupon.current_usage >= coupon.max_total_usage) {
      await query("UPDATE coupons SET status = 'exhausted' WHERE id = ?", [coupon.id]);
      return NextResponse.json({ valid: false, error: 'This coupon has reached its usage limit' });
    }

    // ── 5. Per-user usage limit ───────────────────────────────────────────────
    const [{ user_usage }] = await query<{ user_usage: number }[]>(
      `SELECT COUNT(*) AS user_usage FROM coupon_usages
       WHERE coupon_id = ? AND customer_id = ? AND usage_status = 'applied'`,
      [coupon.id, customer_id]
    );
    if (user_usage >= coupon.max_usage_per_user) {
      return NextResponse.json({ valid: false, error: 'You have already used this coupon the maximum number of times' });
    }

    // ── 6. Once per order ─────────────────────────────────────────────────────
    if (coupon.once_per_order && order_id) {
      const [{ order_usage }] = await query<{ order_usage: number }[]>(
        `SELECT COUNT(*) AS order_usage FROM coupon_usages
         WHERE coupon_id = ? AND order_id = ? AND usage_status = 'applied'`,
        [coupon.id, order_id]
      );
      if (order_usage > 0) {
        return NextResponse.json({ valid: false, error: 'This coupon has already been applied to this order' });
      }
    }

    // ── 7. Minimum order value ────────────────────────────────────────────────
    if (parseFloat(order_amount) < parseFloat(coupon.min_order_value)) {
      return NextResponse.json({
        valid: false,
        error: `Minimum order value of ₹${coupon.min_order_value} required to use this coupon`,
      });
    }

    // ── 8. Category restriction ───────────────────────────────────────────────
    if (Array.isArray(coupon.applicable_categories) && coupon.applicable_categories.length > 0) {
      if (!category_id || !coupon.applicable_categories.includes(Number(category_id))) {
        return NextResponse.json({ valid: false, error: 'This coupon is not applicable for the selected category' });
      }
    }

    // ── 9. Partner restriction ────────────────────────────────────────────────
    if (Array.isArray(coupon.applicable_partners) && coupon.applicable_partners.length > 0) {
      if (!partner_id || !coupon.applicable_partners.includes(Number(partner_id))) {
        return NextResponse.json({ valid: false, error: 'This coupon is not applicable for the selected partner' });
      }
    }

    // ── 10. City restriction ──────────────────────────────────────────────────
    if (Array.isArray(coupon.applicable_cities) && coupon.applicable_cities.length > 0) {
      if (!city || !coupon.applicable_cities.map((c: string) => c.toLowerCase()).includes(String(city).toLowerCase())) {
        return NextResponse.json({ valid: false, error: 'This coupon is not available in your city' });
      }
    }

    // ── 11. Service restriction ───────────────────────────────────────────────
    if (Array.isArray(coupon.applicable_services) && coupon.applicable_services.length > 0) {
      if (!service_id || !coupon.applicable_services.includes(Number(service_id))) {
        return NextResponse.json({ valid: false, error: 'This coupon is not applicable for the selected service' });
      }
    }

    // ── 12. Audience / eligibility ────────────────────────────────────────────
    if (coupon.audience_type === 'specific_users') {
      const [{ eligible }] = await query<{ eligible: number }[]>(
        'SELECT COUNT(*) AS eligible FROM coupon_user_eligibility WHERE coupon_id = ? AND customer_id = ?',
        [coupon.id, customer_id]
      );
      if (!eligible) {
        return NextResponse.json({ valid: false, error: 'You are not eligible for this coupon' });
      }
    }

    if (coupon.audience_type === 'new_users') {
      const [{ order_count }] = await query<{ order_count: number }[]>(
        'SELECT COUNT(*) AS order_count FROM bookings WHERE customer_id = ? AND deleted_at IS NULL',
        [customer_id]
      );
      if (order_count > 0) {
        return NextResponse.json({ valid: false, error: 'This coupon is only for new users' });
      }
    }

    if (coupon.audience_type === 'first_time') {
      const [{ prev_usage }] = await query<{ prev_usage: number }[]>(
        'SELECT COUNT(*) AS prev_usage FROM coupon_usages WHERE customer_id = ? AND usage_status = \'applied\'',
        [customer_id]
      );
      if (prev_usage > 0) {
        return NextResponse.json({ valid: false, error: 'This coupon is only for first-time users' });
      }
    }

    // ── 13. Calculate discount ────────────────────────────────────────────────
    let discountAmount = 0;
    const amount = parseFloat(order_amount);

    if (coupon.discount_type === 'percentage') {
      discountAmount = (amount * parseFloat(coupon.discount_value)) / 100;
    } else {
      discountAmount = parseFloat(coupon.discount_value);
    }

    // Apply max discount cap
    if (coupon.max_discount_amount !== null) {
      discountAmount = Math.min(discountAmount, parseFloat(coupon.max_discount_amount));
    }

    // Cannot exceed order amount
    discountAmount = Math.min(discountAmount, amount);
    discountAmount = Math.round(discountAmount * 100) / 100;

    const finalAmount = Math.max(0, amount - discountAmount);

    return NextResponse.json({
      valid: true,
      coupon_id: coupon.id,
      coupon_code: coupon.code,
      coupon_name: coupon.name,
      discount_type: coupon.discount_type,
      discount_value: parseFloat(coupon.discount_value),
      discount_amount: discountAmount,
      original_amount: amount,
      final_amount: finalAmount,
      message: `Coupon applied! You save ₹${discountAmount.toFixed(2)}`,
    });
  } catch (err) {
    console.error('coupon validate error:', err);
    return NextResponse.json({ valid: false, error: 'Internal server error' }, { status: 500 });
  }
}
