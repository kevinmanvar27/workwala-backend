import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';

// Parses a "lat,lng" address string into {lat, lng} or null.
function parseCoordsFromAddress(address: string): { lat: number; lng: number } | null {
  const parts = address.split(',');
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0].trim());
  const lng = parseFloat(parts[1].trim());
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

// Generates a cryptographically random 6-digit OTP string.
function generateOtp(): string {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return digits.toString();
}

// POST /api/partner/jobs/accept
// Body: { booking_id: number }
// Atomically claims the booking for this partner (status: finding → matched),
// generates a 6-digit OTP stored on the booking for customer verification.
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || payload.roleSlug !== 'partner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { booking_id } = await req.json();
    if (!booking_id) {
      return NextResponse.json({ error: 'booking_id is required' }, { status: 400 });
    }

    const otp = generateOtp();

    // Atomically claim the booking: only succeeds if still in 'finding' state
    const result = await query<{ affectedRows: number }>(
      `UPDATE bookings
          SET status     = 'matched',
              partner_id = ?,
              otp_code   = ?
        WHERE id = ?
          AND status = 'finding'
          AND partner_id IS NULL`,
      [payload.userId, otp, booking_id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { error: 'Booking no longer available' },
        { status: 409 }
      );
    }

    // Fetch full booking details to return to the partner app
    const bookings = await query<Array<{
      id: number;
      service_name: string;
      duration_minutes: number;
      price_per_hour: string;
      total_price: string;
      address: string;
      lat: string | null;
      lng: string | null;
      otp_code: string;
      customer_name: string | null;
      customer_phone: string;
    }>>(
      `SELECT b.id,
              COALESCE(cat.name, s.name)        AS service_name,
              b.duration_minutes,
              b.price_per_hour,
              b.total_price,
              b.address,
              b.lat,
              b.lng,
              b.otp_code,
              COALESCE(c.name, c.phone)          AS customer_name,
              c.phone                            AS customer_phone
       FROM bookings b
       JOIN services s   ON s.id = b.service_id
       LEFT JOIN categories cat ON cat.id = s.category_id AND cat.deleted_at IS NULL
       JOIN customers c  ON c.id = b.customer_id
       WHERE b.id = ? AND b.partner_id = ?
       LIMIT 1`,
      [booking_id, payload.userId]
    );

    if (bookings.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const b = bookings[0];

    // Resolve lat/lng — prefer stored columns, fall back to parsing address string
    let resolvedLat: number | null = b.lat ? Number(b.lat) : null;
    let resolvedLng: number | null = b.lng ? Number(b.lng) : null;
    if (resolvedLat === null || resolvedLng === null) {
      const parsed = parseCoordsFromAddress(b.address);
      if (parsed) {
        resolvedLat = parsed.lat;
        resolvedLng = parsed.lng;
      }
    }

    return NextResponse.json({
      success:          true,
      booking_id:       b.id,
      status:           'matched',
      service_name:     b.service_name,
      duration_minutes: b.duration_minutes,
      price_per_hour:   parseFloat(b.price_per_hour),
      total_price:      parseFloat(b.total_price),
      address:          b.address,
      lat:              resolvedLat,
      lng:              resolvedLng,
      otp_code:         b.otp_code,
      customer_name:    b.customer_name ?? 'Customer',
      customer_phone:   b.customer_phone,
    });
  } catch (err) {
    console.error('[partner/jobs/accept] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
