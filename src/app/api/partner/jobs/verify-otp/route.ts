import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';
import { createHmac } from 'crypto';

// Hash the submitted OTP before comparing against the stored hash.
function hashBookingOtp(otp: string): string {
  const pepper = process.env.OTP_PEPPER;
  if (!pepper) throw new Error('[jobs/verify-otp] OTP_PEPPER is not set');
  return createHmac('sha256', pepper).update(otp).digest('hex');
}

// POST /api/partner/jobs/verify-otp
// Body: { booking_id: number, otp: string }
// Verifies the OTP the customer shows to the partner.
// On success: transitions booking status matched → in_progress.
export async function POST(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'partner');
    if (authError) return authError;

    const body = await req.json();
    const booking_id = parseInt(body.booking_id, 10);
    const otp = body.otp;

    if (!Number.isInteger(booking_id) || booking_id <= 0) {
      return NextResponse.json({ error: 'booking_id must be a positive integer' }, { status: 400 });
    }
    if (!otp) {
      return NextResponse.json({ error: 'otp is required' }, { status: 400 });
    }

    // Fetch booking — must belong to this partner and be in 'matched' state
    const rows = await query<Array<{
      id: number;
      otp_code: string | null;
      status: string;
    }>>(
      `SELECT id, otp_code, status
       FROM bookings
       WHERE id = ? AND partner_id = ?
       LIMIT 1`,
      [booking_id, payload.userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const booking = rows[0];

    if (booking.status !== 'matched') {
      return NextResponse.json(
        { error: 'Booking is not in matched state' },
        { status: 409 }
      );
    }

    // Compare HMAC hash of submitted OTP against stored hash
    if (!booking.otp_code || booking.otp_code !== hashBookingOtp(otp.trim())) {
      return NextResponse.json({ error: 'Incorrect OTP' }, { status: 422 });
    }

    // OTP correct — mark as in_progress
    await query(
      `UPDATE bookings SET status = 'in_progress' WHERE id = ?`,
      [booking_id]
    );

    return NextResponse.json({ success: true, status: 'in_progress' });
  } catch (err) {
    console.error('[partner/jobs/verify-otp] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
