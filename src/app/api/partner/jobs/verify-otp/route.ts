import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';

// POST /api/partner/jobs/verify-otp
// Body: { booking_id: number, otp: string }
// Verifies the OTP the customer shows to the partner.
// On success: transitions booking status finding → in_progress.
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload || payload.roleSlug !== 'partner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { booking_id, otp } = await req.json();
    if (!booking_id || !otp) {
      return NextResponse.json(
        { error: 'booking_id and otp are required' },
        { status: 400 }
      );
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

    if (!booking.otp_code || booking.otp_code.trim() !== otp.trim()) {
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
