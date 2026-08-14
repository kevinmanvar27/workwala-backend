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

// GET /api/partner/jobs/pending
// Returns the nearest unassigned booking with status='finding'.
// Priority order:
//   1. Bookings WITH resolvable coordinates (lat/lng columns OR "lat,lng" address), nearest first
//   2. Bookings with text-only addresses, newest first
// customer_name falls back to phone number when name is NULL.
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload || payload.roleSlug !== 'partner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch partner's last known location (saved when they went online)
    const partnerRows = await query<{ lat: number | null; lng: number | null }[]>(
      `SELECT lat, lng FROM partners WHERE id = ? LIMIT 1`,
      [payload.userId]
    );
    const partnerLat = partnerRows[0]?.lat ?? null;
    const partnerLng = partnerRows[0]?.lng ?? null;

    type BookingRow = {
      id: number;
      service_name: string;
      duration_minutes: number;
      price_per_hour: string;
      total_price: string;
      address: string;
      customer_name: string | null;
      customer_phone: string;
      lat: number | null;
      lng: number | null;
    };

    // Fetch all pending jobs (no distance filter yet — we'll resolve coords from address too)
    const bookings = await query<BookingRow[]>(
      `SELECT
         b.id,
         s.name                              AS service_name,
         b.duration_minutes,
         b.price_per_hour,
         b.total_price,
         b.address,
         COALESCE(c.name, c.phone)           AS customer_name,
         c.phone                             AS customer_phone,
         b.lat,
         b.lng
       FROM bookings b
       JOIN services  s ON s.id = b.service_id
       JOIN customers c ON c.id = b.customer_id
       WHERE b.status = 'finding'
         AND b.partner_id IS NULL
       ORDER BY b.created_at DESC`,
      []
    );

    if (bookings.length === 0) {
      return NextResponse.json({ success: true, job: null });
    }

    // Resolve coordinates for each booking (lat/lng column OR parsed from address string)
    type ResolvedBooking = BookingRow & { resolvedLat: number | null; resolvedLng: number | null; distanceKm: number | null };

    const resolved: ResolvedBooking[] = bookings.map((b) => {
      let resolvedLat = b.lat ? Number(b.lat) : null;
      let resolvedLng = b.lng ? Number(b.lng) : null;

      // If lat/lng columns are null, try parsing from address string "lat,lng"
      if (resolvedLat === null || resolvedLng === null) {
        const parsed = parseCoordsFromAddress(b.address);
        if (parsed) {
          resolvedLat = parsed.lat;
          resolvedLng = parsed.lng;
        }
      }

      // Calculate Haversine distance if we have both partner and booking coords
      let distanceKm: number | null = null;
      if (partnerLat !== null && partnerLng !== null && resolvedLat !== null && resolvedLng !== null) {
        const R = 6371;
        const dLat = (resolvedLat - partnerLat) * Math.PI / 180;
        const dLng = (resolvedLng - partnerLng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos(partnerLat * Math.PI / 180) * Math.cos(resolvedLat * Math.PI / 180) *
          Math.sin(dLng / 2) ** 2;
        distanceKm = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
      }

      return { ...b, resolvedLat, resolvedLng, distanceKm };
    });

    // Sort: jobs with resolvable coords first (nearest), then address-only (newest already from query)
    resolved.sort((a, b) => {
      const aHasCoords = a.resolvedLat !== null;
      const bHasCoords = b.resolvedLat !== null;
      if (aHasCoords && !bHasCoords) return -1;
      if (!aHasCoords && bHasCoords) return 1;
      // Both have coords — sort by distance
      if (aHasCoords && bHasCoords) {
        const aDist = a.distanceKm ?? Infinity;
        const bDist = b.distanceKm ?? Infinity;
        // Filter out jobs > 50 km — skip them (they'll be at the end)
        return aDist - bDist;
      }
      return 0; // both address-only — keep DESC created_at order from query
    });

    // Skip coordinate jobs that are > 50 km away (but keep address-only jobs)
    const best = resolved.find((b) => {
      if (b.resolvedLat !== null && b.distanceKm !== null && b.distanceKm > 50) return false;
      return true;
    });

    if (!best) {
      return NextResponse.json({ success: true, job: null });
    }

    return NextResponse.json({
      success: true,
      job: {
        id:               best.id,
        service_name:     best.service_name,
        duration_minutes: best.duration_minutes,
        price_per_hour:   parseFloat(best.price_per_hour),
        total_price:      parseFloat(best.total_price),
        address:          best.address,
        customer_name:    best.customer_name ?? 'Customer',
        customer_phone:   best.customer_phone,
        // Return resolved coords so the app can show the map immediately
        lat:              best.resolvedLat,
        lng:              best.resolvedLng,
        distance_km:      best.distanceKm,
      },
    });
  } catch (err) {
    console.error('[partner/jobs/pending] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
