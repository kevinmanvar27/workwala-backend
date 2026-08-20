import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';

// POST /api/customer/bookings/[id]/payment-pending
// Customer clicks Complete Work (but hasn't paid yet).
// Transitions booking status: in_progress → payment_pending
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

    // No payment method needed yet

    // Fetch booking — must belong to this customer and be in_progress
    const rows = await query<Array<{
      id: number;
      status: string;
      total_price: string;
      partner_id: number | null;
      service_name: string;
    }>>(
      `SELECT b.id, b.status, b.total_price, b.partner_id,
              COALESCE(cat.name, s.name) AS service_name
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       LEFT JOIN categories cat ON cat.id = s.category_id AND cat.deleted_at IS NULL
       WHERE b.id = ? AND b.customer_id = ?
         AND b.deleted_at IS NULL
       LIMIT 1`,
      [bookingId, payload.userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const booking = rows[0];

    if (booking.status !== 'in_progress') {
      return NextResponse.json(
        { error: `Booking is in '${booking.status}' state, expected 'in_progress'` },
        { status: 409 }
      );
    }

    // Mark booking as payment_pending
    await query(
      `UPDATE bookings
          SET status = 'payment_pending',
              completed_at = NOW()
        WHERE id = ?`,
      [bookingId]
    );

    return NextResponse.json({
      success: true,
      booking_id: bookingId,
      status: 'payment_pending',
      total_price: parseFloat(booking.total_price),
    });
  } catch (err) {
    console.error('[customer/bookings/complete] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
