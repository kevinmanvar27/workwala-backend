import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';

// GET /api/customer/bookings/[id]/status
// Returns the current status of a booking, plus partner info when matched.
// NOTE: otp_code is intentionally NOT returned here — the OTP is shown to the
// customer via the partner app. The customer never needs the raw OTP hash.
export async function GET(
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

    const rows = await query<Array<{
      id: number;
      status: string;
      partner_id: number | null;
      partner_name: string | null;
      partner_phone: string | null;
    }>>(
      `SELECT b.id, b.status, b.partner_id,
              COALESCE(p.name, p.phone) AS partner_name,
              p.phone AS partner_phone
       FROM bookings b
       LEFT JOIN partners p ON p.id = b.partner_id
       WHERE b.id = ? AND b.customer_id = ?
       LIMIT 1`,
      [bookingId, payload.userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const b = rows[0];
    return NextResponse.json({
      success: true,
      id: b.id,
      status: b.status,
      partner_id: b.partner_id ?? null,
      partner_name: b.partner_name ?? null,
      partner_phone: b.partner_phone ?? null,
      // otp_code is deliberately omitted — the customer never needs the hash
    });
  } catch (err) {
    console.error('booking status GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
