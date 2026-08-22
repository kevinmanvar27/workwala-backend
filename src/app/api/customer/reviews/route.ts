import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';

// GET /api/customer/reviews
// Fetch all reviews submitted by the authenticated customer
export async function GET(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'customer');
    if (authError) return authError;

    const reviews = await query<Array<{
      id: number;
      booking_id: number;
      rating: number;
      comment: string | null;
      partner_name: string | null;
      service_name: string | null;
      created_at: string;
      updated_at: string;
    }>>(
      `SELECT 
        r.id,
        r.booking_id,
        r.rating,
        r.comment,
        p.name as partner_name,
        s.name as service_name,
        r.created_at,
        r.updated_at
       FROM reviews r
       LEFT JOIN partners p ON r.partner_id = p.id
       LEFT JOIN bookings b ON r.booking_id = b.id
       LEFT JOIN services s ON b.service_id = s.id
       WHERE r.customer_id = ? AND r.deleted_at IS NULL
       ORDER BY r.created_at DESC`,
      [payload.userId]
    );

    return NextResponse.json({ success: true, reviews });
  } catch (err) {
    console.error('[reviews GET] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
