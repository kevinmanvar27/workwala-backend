import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';

// Parses a "lat,lng" address string into {lat, lng} or null.
function parseCoordsFromAddress(address: string): { lat: number; lng: number } | null {
  const parts = address.split(',');
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0].trim());
  const lng = parseFloat(parts[1].trim());
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

// GET /api/partner/jobs/active
// Returns the partner's current active booking (matched or in_progress), or null.
// Used by the splash screen to restore the correct screen after app reopen.
export async function GET(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'partner');
    if (authError) return authError;

    const rows = await query<Array<{
      id: number;
      status: string;
      service_name: string;
      duration_minutes: number;
      price_per_hour: string;
      total_price: string;
      address: string;
      lat: string | null;
      lng: string | null;
      customer_name: string | null;
      customer_phone: string;
      otp_code: string | null;
      started_at: Date | null;
    }>>(
      `SELECT b.id,
              b.status,
              COALESCE(cat.name, s.name)   AS service_name,
              b.duration_minutes,
              b.price_per_hour,
              b.total_price,
              b.address,
              b.lat,
              b.lng,
              COALESCE(c.name, c.phone)    AS customer_name,
              c.phone                      AS customer_phone,
              b.otp_code,
              b.started_at
       FROM bookings b
       JOIN services s   ON s.id = b.service_id
       LEFT JOIN categories cat ON cat.id = s.category_id AND cat.deleted_at IS NULL
       JOIN customers c  ON c.id = b.customer_id
       WHERE b.partner_id = ?
         AND b.status IN ('matched', 'in_progress', 'payment_pending')
         AND b.deleted_at IS NULL
       ORDER BY b.updated_at DESC
       LIMIT 1`,
      [payload.userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ success: true, job: null });
    }

    const b = rows[0];

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
      success: true,
      job: {
        id:               b.id,
        status:           b.status,           // 'matched' | 'in_progress'
        service_name:     b.service_name,
        duration_minutes: b.duration_minutes,
        price_per_hour:   parseFloat(b.price_per_hour),
        total_price:      parseFloat(b.total_price),
        address:          b.address,
        lat:              resolvedLat,
        lng:              resolvedLng,
        customer_name:    b.customer_name ?? 'Customer',
        customer_phone:   b.customer_phone,
        // otp_code hash is included so OtpVerificationScreen can verify locally if needed
        // (verification is done server-side via /api/partner/jobs/verify-otp)
        otp_code:         b.otp_code ?? null,
        started_at:       b.started_at?.toISOString() ?? null,
      },
    });
  } catch (err) {
    console.error('[partner/jobs/active] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
