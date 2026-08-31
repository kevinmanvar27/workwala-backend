import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';
import { randomInt, createHmac } from 'crypto';
import { notifyAdmins, notifyCustomer } from '@/lib/notificationHelper';

// Parses a "lat,lng" address string into {lat, lng} or null.
function parseCoordsFromAddress(address: string): { lat: number; lng: number } | null {
  const parts = address.split(',');
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0].trim());
  const lng = parseFloat(parts[1].trim());
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

// Generates a cryptographically secure 6-digit OTP string.
function generateOtp(): string {
  return randomInt(100000, 1000000).toString();
}

// HMAC-SHA256 hash the booking OTP before storing it.
// Uses OTP_PEPPER so even a DB dump can't reveal the OTP.
function hashBookingOtp(otp: string): string {
  const pepper = process.env.OTP_PEPPER;
  if (!pepper) throw new Error('[jobs/accept] OTP_PEPPER is not set');
  return createHmac('sha256', pepper).update(otp).digest('hex');
}

// POST /api/partner/jobs/accept
// Body: { booking_id: number }
// Atomically claims the booking for this partner (status: finding → matched),
// generates a 6-digit OTP stored as HMAC-SHA256 hash on the booking.
export async function POST(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'partner');
    if (authError) return authError;

    const body = await req.json();
    const booking_id = parseInt(body.booking_id, 10);
    if (!Number.isInteger(booking_id) || booking_id <= 0) {
      return NextResponse.json({ error: 'booking_id must be a positive integer' }, { status: 400 });
    }

    const otp     = generateOtp();
    const otpHash = hashBookingOtp(otp); // Store hash, return plaintext to partner app only

    // Atomically claim the booking: only succeeds if still in 'finding' state.
    // Store both the hash (for partner verification) and plaintext (for customer display).
    const result = await query<{ affectedRows: number }>(
      `UPDATE bookings
          SET status        = 'matched',
              partner_id    = ?,
              otp_code      = ?,
              otp_plaintext = ?
        WHERE id = ?
          AND status = 'finding'
          AND partner_id IS NULL`,
      [payload.userId, otpHash, otp, booking_id]
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
      customer_id: number;
      service_name: string;
      duration_minutes: number;
      price_per_hour: string;
      total_price: string;
      address: string;
      lat: string | null;
      lng: string | null;
      customer_name: string | null;
      customer_phone: string;
    }>>(
      `SELECT b.id,
              b.customer_id,
              COALESCE(cat.name, s.name)        AS service_name,
              b.duration_minutes,
              b.price_per_hour,
              b.total_price,
              b.address,
              b.lat,
              b.lng,
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

    // Send push notifications about booking acceptance
    console.log(`[NOTIFY] Booking accepted: ID ${booking_id}, Partner: ${payload.userId}, Customer: ${b.customer_phone}`);
    
    // Notify customer that partner has been found
    await notifyCustomer(
      b.customer_id,
      'Partner Found!',
      `A partner has been assigned for your ${b.service_name} service`,
      { type: 'partner_found', booking_id: booking_id.toString(), service_name: b.service_name },
      'user-notifications'
    );

    // Notify admins about booking acceptance
    await notifyAdmins(
      'notify_booking_accepted',
      'Booking Accepted',
      `Booking #${booking_id} accepted by partner for ${b.service_name} - ₹${b.total_price}`,
      { 
        type: 'booking_accepted', 
        booking_id: booking_id.toString(), 
        partner_id: payload.userId.toString(),
        service_name: b.service_name,
        total_price: b.total_price,
        customer_phone: b.customer_phone
      },
      'partner-notifications'
    );

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
      // Return the raw OTP to the partner app — they show it to the customer.
      // The DB only stores the hash; this is the only time the plaintext is available.
      otp_code:         otp,
      customer_name:    b.customer_name ?? 'Customer',
      customer_phone:   b.customer_phone,
    });
  } catch (err) {
    console.error('[partner/jobs/accept] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
