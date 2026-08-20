import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';

// GET /api/partner/jobs/[id]/payment-status
// Partner polls this to know when the customer has confirmed payment.
// Returns { paid: true, payment_method, total_price } once status = 'completed'.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'partner');
    if (authError) return authError;

    const { id } = await params;
    const bookingId = parseInt(id, 10);
    if (isNaN(bookingId) || bookingId <= 0) {
      return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
    }

    const rows = await query<Array<{
      id: number;
      status: string;
      total_price: string;
      payment_method: string | null;
    }>>(
      `SELECT id, status, total_price, payment_method
       FROM bookings
       WHERE id = ? AND partner_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [bookingId, payload.userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const b = rows[0];
    const paid = b.status === 'completed';

    return NextResponse.json({
      success: true,
      booking_id: b.id,
      status: b.status,
      paid,
      total_price: parseFloat(b.total_price),
      payment_method: b.payment_method ?? null,
    });
  } catch (err) {
    console.error('[partner/jobs/payment-status] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
