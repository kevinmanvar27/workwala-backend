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
// On success: transitions booking status matched → in_progress and returns full booking details.
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
    // Also join users table to get customer name/phone and services for service_name
    const rows = await query<Array<{
      id: number;
      otp_code: string | null;
      status: string;
      service_name: string;
      duration_minutes: number;
      price_per_hour: string;
      total_price: string;
      address: string;
      lat: string | null;
      lng: string | null;
      customer_name: string | null;
      customer_phone: string | null;
    }>>(
      `SELECT b.id, b.otp_code, b.status,
              COALESCE(cat.name, s.name)   AS service_name,
              b.duration_minutes,
              b.price_per_hour,
              b.total_price,
              b.address,
              b.lat,
              b.lng,
              COALESCE(c.name, c.phone)    AS customer_name,
              c.phone                      AS customer_phone
       FROM bookings b
       JOIN services  s   ON s.id = b.service_id
       LEFT JOIN categories cat ON cat.id = s.category_id AND cat.deleted_at IS NULL
       JOIN customers c   ON c.id = b.customer_id
       WHERE b.id = ? AND b.partner_id = ?
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
      `UPDATE bookings SET status = 'in_progress', started_at = NOW() WHERE id = ?`,
      [booking_id]
    );

    // Fetch the exact started_at time
    const startedRow = await query<Array<{ started_at: Date }>>(
      `SELECT started_at FROM bookings WHERE id = ?`,
      [booking_id]
    );
    const started_at = startedRow[0]?.started_at?.toISOString() || new Date().toISOString();

    // Return full booking details so the app can pass them through the screen chain
    return NextResponse.json({
      success: true,
      status: 'in_progress',
      booking: {
        booking_id:       booking.id,
        service_name:     booking.service_name,
        duration_minutes: booking.duration_minutes,
        price_per_hour:   parseFloat(booking.price_per_hour as unknown as string),
        total_price:      parseFloat(booking.total_price as unknown as string),
        address:          booking.address,
        lat:              booking.lat   != null ? parseFloat(booking.lat)   : null,
        lng:              booking.lng   != null ? parseFloat(booking.lng)   : null,
        customer_name:    booking.customer_name  ?? 'Customer',
        customer_phone:   booking.customer_phone ?? '',
        started_at:       started_at,
      },
    });
  } catch (err) {
    console.error('[partner/jobs/verify-otp] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
