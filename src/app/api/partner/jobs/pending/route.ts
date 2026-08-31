import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';

function parseCoordsFromAddress(address: string): { lat: number; lng: number } | null {
  const parts = address.split(',');
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0].trim());
  const lng = parseFloat(parts[1].trim());
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

// GET /api/partner/jobs/pending
// Returns the nearest unassigned booking with status='finding' that matches
// one of the partner's registered service categories.
export async function GET(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'partner');
    if (authError) return authError;

    // Fetch partner row — need status, categories, location, and when they last
    // sent a location update so we can judge whether the coords are fresh.
    const partnerRows = await query<{
      lat: number | null;
      lng: number | null;
      categories: string | null;
      status: string;
      last_seen_at: Date | null;
    }[]>(
      `SELECT lat, lng, categories, status, last_seen_at
       FROM partners WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [payload.userId]
    );

    if (partnerRows.length === 0) {
      return NextResponse.json({ success: true, job: null });
    }

    const partner = partnerRows[0];

    // Only approved partners receive jobs
    if (partner.status !== 'approved') {
      return NextResponse.json({ success: true, job: null });
    }

    // Parse partner's registered service categories (e.g. ["Driver","Cooking"])
    let partnerCategories: string[] = [];
    try {
      partnerCategories = JSON.parse(partner.categories || '[]');
    } catch {
      partnerCategories = [];
    }

    if (partnerCategories.length === 0) {
      return NextResponse.json({ success: true, job: null });
    }

    // ── Location freshness check ──────────────────────────────────────────────
    // Only use the partner's stored coordinates for distance filtering if they
    // were updated within the last 30 minutes. Stale coordinates (old test data,
    // previous session) must NOT silently hide jobs from the partner.
    const LOCATION_STALE_MINUTES = 30;
    let partnerLat: number | null = null;
    let partnerLng: number | null = null;

    if (partner.last_seen_at != null && partner.lat != null && partner.lng != null) {
      const ageMs = Date.now() - new Date(partner.last_seen_at).getTime();
      const ageMins = ageMs / 60000;
      if (ageMins <= LOCATION_STALE_MINUTES) {
        // Fresh location — use it for distance filtering
        partnerLat = Number(partner.lat);
        partnerLng = Number(partner.lng);
      }
      // else: coords are stale — partnerLat/Lng stay null → show all jobs
    }
    // last_seen_at is null (never sent location) → partnerLat/Lng stay null → show all jobs

    // ── Category-matched booking query ───────────────────────────────────────
    // CAST placeholders fix the collation mismatch between the utf8mb4_bin
    // categories JSON column and the utf8mb4_unicode_ci service/category names.
    const castPlaceholders = partnerCategories
      .map(() => 'CAST(? AS CHAR CHARACTER SET utf8mb4)')
      .join(', ');

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
      icon_url: string | null;
      bg_color: string;
    };

    const bookings = await query<BookingRow[]>(
      `SELECT
         b.id,
         COALESCE(cat.name, s.name)          AS service_name,
         b.duration_minutes,
         b.price_per_hour,
         b.total_price,
         b.address,
         COALESCE(c.name, c.phone)           AS customer_name,
         c.phone                             AS customer_phone,
         b.lat,
         b.lng,
         s.icon_url,
         COALESCE(s.bg_color, '#F0F5FF')     AS bg_color
       FROM bookings b
       JOIN services  s   ON s.id = b.service_id
       LEFT JOIN categories cat
              ON cat.id = s.category_id AND cat.deleted_at IS NULL
       JOIN customers c   ON c.id = b.customer_id
       WHERE b.status     = 'finding'
         AND b.partner_id IS NULL
         AND b.deleted_at IS NULL
         AND COALESCE(cat.name, s.name) COLLATE utf8mb4_unicode_ci
             IN (${castPlaceholders})
       ORDER BY b.created_at DESC`,
      [...partnerCategories]
    );

    if (bookings.length === 0) {
      return NextResponse.json({ success: true, job: null });
    }

    // ── Resolve coordinates + calculate distances ─────────────────────────────
    type ResolvedBooking = BookingRow & {
      resolvedLat: number | null;
      resolvedLng: number | null;
      distanceKm: number | null;
    };

    const resolved: ResolvedBooking[] = bookings.map((b) => {
      let resolvedLat = b.lat != null ? Number(b.lat) : null;
      let resolvedLng = b.lng != null ? Number(b.lng) : null;

      if (resolvedLat === null || resolvedLng === null) {
        const parsed = parseCoordsFromAddress(b.address);
        if (parsed) { resolvedLat = parsed.lat; resolvedLng = parsed.lng; }
      }

      let distanceKm: number | null = null;
      if (partnerLat !== null && partnerLng !== null && resolvedLat !== null && resolvedLng !== null) {
        const R = 6371;
        const dLat = (resolvedLat - partnerLat) * (Math.PI / 180);
        const dLng = (resolvedLng - partnerLng) * (Math.PI / 180);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(partnerLat * (Math.PI / 180)) *
          Math.cos(resolvedLat * (Math.PI / 180)) *
          Math.sin(dLng / 2) ** 2;
        distanceKm = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
      }

      return { ...b, resolvedLat, resolvedLng, distanceKm };
    });

    // Sort: nearest-first when coords available, newest-first otherwise
    resolved.sort((a, b) => {
      const aHas = a.resolvedLat !== null && a.distanceKm !== null;
      const bHas = b.resolvedLat !== null && b.distanceKm !== null;
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      if (aHas && bHas) return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
      return 0;
    });

    // ── Distance filter ───────────────────────────────────────────────────────
    // Only apply when we have FRESH partner coordinates (checked above).
    // If partner location is stale/unknown → show all matching jobs.
    // Distance limit: 100 km (covers typical Indian city + surrounding areas).
    const DISTANCE_LIMIT_KM = 100;

    const best = resolved.find((b) => {
      // No fresh partner location → always show the job
      if (partnerLat === null || partnerLng === null) return true;
      // Partner has fresh location but booking has no coords → show it
      if (b.distanceKm === null) return true;
      // Both have coords — apply limit
      return b.distanceKm <= DISTANCE_LIMIT_KM;
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
        lat:              best.resolvedLat,
        lng:              best.resolvedLng,
        distance_km:      best.distanceKm,
        icon_url:         best.icon_url ?? null,
        bg_color:         best.bg_color,
      },
    });
  } catch (err) {
    console.error('[partner/jobs/pending] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
