import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';

// GET /api/partner/reviews
// Returns all reviews that customers have left for the authenticated partner,
// newest first. Used by the partner app's "My Reviews" screen.
export async function GET(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'partner');
    if (authError) return authError;

    const reviews = await query<Array<{
      id: number;
      booking_id: number;
      rating: number;
      comment: string | null;
      customer_name: string | null;
      customer_phone: string | null;
      service_name: string | null;
      created_at: string;
    }>>(
      `SELECT
         r.id,
         r.booking_id,
         r.rating,
         r.comment,
         COALESCE(c.name, c.phone) AS customer_name,
         c.phone                   AS customer_phone,
         COALESCE(cat.name, s.name) AS service_name,
         r.created_at
       FROM reviews r
       LEFT JOIN customers c  ON r.customer_id  = c.id
       LEFT JOIN bookings  b  ON r.booking_id   = b.id
       LEFT JOIN services  s  ON b.service_id   = s.id
       LEFT JOIN categories cat ON cat.id = s.category_id AND cat.deleted_at IS NULL
       WHERE r.partner_id = ? AND r.deleted_at IS NULL
       ORDER BY r.created_at DESC`,
      [payload.userId]
    );

    return NextResponse.json({ success: true, reviews });
  } catch (err) {
    console.error('[partner/reviews GET] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
