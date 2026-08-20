import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';

// POST /api/customer/bookings/[id]/review
// Customer submits a star rating for the partner after job completion.
// Body: { rating: 1-5 }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'customer');
    if (authError) return authError;

    const { id } = await params;
    const bookingId = parseInt(id, 10);
    if (isNaN(bookingId) || bookingId <= 0) {
      return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
    }

    const body = await req.json();
    const rating = parseInt(body?.rating, 10);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'rating must be between 1 and 5' }, { status: 400 });
    }

    // Verify the booking belongs to this customer and is completed
    const bookings = await query<Array<{ id: number; partner_id: number | null; status: string }>>(
      `SELECT id, partner_id, status
       FROM bookings
       WHERE id = ? AND customer_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [bookingId, payload.userId]
    );

    if (bookings.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const booking = bookings[0];
    if (booking.status !== 'completed') {
      return NextResponse.json({ error: 'Booking is not completed yet' }, { status: 400 });
    }

    if (!booking.partner_id) {
      return NextResponse.json({ error: 'No partner assigned to this booking' }, { status: 400 });
    }

    // Update the partner's rating — simple rolling average stored on the partner row.
    // Uses a safe COALESCE so partners with no prior rating start fresh.
    await query(
      `UPDATE partners
       SET rating = ROUND(
         COALESCE(
           (rating * COALESCE(total_reviews, 0) + ?) /
           NULLIF(COALESCE(total_reviews, 0) + 1, 0),
           ?
         ), 2
       ),
       total_reviews = COALESCE(total_reviews, 0) + 1,
       updated_at = NOW()
       WHERE id = ?`,
      [rating, rating, booking.partner_id]
    );

    return NextResponse.json({ success: true, rating });
  } catch (err) {
    console.error('[bookings/review] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
