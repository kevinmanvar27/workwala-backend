import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';
import { notifyNearbyPartners, notifyCustomer, notifyAdmins } from '@/lib/notificationHelper';

// ── Wave search configuration ─────────────────────────────────────────────────
// Defaults used when no DB setting exists yet.
const DEFAULT_WAVE_INTERVAL_SECONDS = 30;
const DEFAULT_WAVE_MAX_RADIUS_KM    = 5;

async function getWaveSettings(): Promise<{ intervalSeconds: number; maxRadiusKm: number }> {
  try {
    const rows = await query<{ key_name: string; value: string }[]>(
      `SELECT key_name, value FROM settings
       WHERE key_name IN ('booking_search_wave_interval_seconds', 'booking_search_max_radius_km')
         AND deleted_at IS NULL`
    );
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key_name] = r.value;
    return {
      intervalSeconds: parseInt(map['booking_search_wave_interval_seconds'] ?? '', 10) || DEFAULT_WAVE_INTERVAL_SECONDS,
      maxRadiusKm:     parseInt(map['booking_search_max_radius_km']          ?? '', 10) || DEFAULT_WAVE_MAX_RADIUS_KM,
    };
  } catch {
    return { intervalSeconds: DEFAULT_WAVE_INTERVAL_SECONDS, maxRadiusKm: DEFAULT_WAVE_MAX_RADIUS_KM };
  }
}

// GET /api/customer/bookings/[id]/status
// Returns the current status of a booking, plus partner info and OTP when matched.
// Also drives wave expansion and auto-cancel when the search window expires.
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
      otp_plaintext: string | null;
      duration_minutes: number;
      started_at: Date | null;
      total_price: string;
      service_name: string;
      customer_id: number;
      search_radius_km: number | null;
      radius_expanded_at: Date | null;
      search_expires_at: Date | null;
    }>>(
      `SELECT b.id, b.status, b.partner_id,
              COALESCE(p.name, p.phone)          AS partner_name,
              p.phone                            AS partner_phone,
              b.otp_plaintext,
              b.duration_minutes,
              b.started_at,
              b.total_price,
              COALESCE(cat.name, s.name)         AS service_name,
              b.customer_id,
              b.search_radius_km,
              b.radius_expanded_at,
              b.search_expires_at
       FROM bookings b
       JOIN services s    ON s.id = b.service_id
       LEFT JOIN categories cat
              ON cat.id = s.category_id AND cat.deleted_at IS NULL
       LEFT JOIN partners p ON p.id = b.partner_id
       WHERE b.id = ? AND b.customer_id = ?
       LIMIT 1`,
      [bookingId, payload.userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const b = rows[0];

    // ── Wave expansion + auto-cancel ──────────────────────────────────────────
    // Only runs while the booking is still in 'finding' state AND the new wave
    // columns are present (search_radius_km is not null = created by new code).
    // Old bookings (search_radius_km IS NULL) pass through untouched.
    if (b.status === 'finding' && b.search_radius_km !== null) {
      const now = Date.now();
      const { intervalSeconds, maxRadiusKm } = await getWaveSettings();

      // ── Auto-cancel: search window expired ───────────────────────────────
      if (b.search_expires_at && now >= new Date(b.search_expires_at).getTime()) {
        // Atomic update — only succeeds if still 'finding' (race-safe)
        const cancelled = await query<{ affectedRows: number }>(
          `UPDATE bookings
           SET status     = 'cancelled',
               updated_at = NOW()
           WHERE id = ? AND status = 'finding'`,
          [bookingId]
        );

        if (cancelled.affectedRows > 0) {
          console.log(`[WAVE] Booking #${bookingId} auto-cancelled — search window expired`);

          // Notify customer so the app can show "No Partner Found" immediately
          await notifyCustomer(
            b.customer_id,
            'No Partner Found',
            `We couldn't find a partner for your ${b.service_name} booking. Please try again.`,
            { type: 'booking_no_partner', booking_id: bookingId.toString() },
            'user-notifications'
          );

          await notifyAdmins(
            'notify_booking_expired',
            'Booking Expired',
            `Booking #${bookingId} auto-cancelled — no partner found (${b.service_name})`,
            { type: 'booking_expired', booking_id: bookingId.toString() },
            'system'
          );
        }

        // Return cancelled status with the special reason so Flutter can
        // distinguish this from a manual customer cancellation.
        return NextResponse.json({
          success:          true,
          id:               b.id,
          status:           'cancelled',
          cancelled_reason: 'no_partner_found',
          partner_id:       null,
          partner_name:     null,
          partner_phone:    null,
          otp_code:         null,
          duration_minutes: b.duration_minutes,
          started_at:       null,
          total_price:      parseFloat(b.total_price as unknown as string),
        });
      }

      // ── Radius expansion: interval elapsed, not yet at max ────────────────
      if (
        b.search_radius_km < maxRadiusKm &&
        b.radius_expanded_at !== null &&
        now - new Date(b.radius_expanded_at).getTime() >= intervalSeconds * 1000
      ) {
        const newRadius = b.search_radius_km + 1;

        // Atomic update — only one concurrent poll wins the race
        // (condition: search_radius_km must still equal the value we read)
        const expanded = await query<{ affectedRows: number }>(
          `UPDATE bookings
           SET search_radius_km   = ?,
               radius_expanded_at = NOW(),
               updated_at         = NOW()
           WHERE id = ?
             AND status           = 'finding'
             AND search_radius_km = ?`,
          [newRadius, bookingId, b.search_radius_km]
        );

        if (expanded.affectedRows > 0) {
          console.log(`[WAVE] Booking #${bookingId} expanded to ${newRadius}km`);
          b.search_radius_km = newRadius; // reflect in response

          // Notify partners newly within range
          await notifyNearbyPartners(
            bookingId,
            newRadius,
            'New Job Available',
            `New ${b.service_name} booking near you`,
            {
              type:         'new_booking',
              booking_id:   bookingId.toString(),
              service_name: b.service_name,
              total_price:  b.total_price,
            },
            'partner-notifications'
          );
        }
      }
    }
    // ── End wave logic ────────────────────────────────────────────────────────

    return NextResponse.json({
      success:          true,
      id:               b.id,
      status:           b.status,
      partner_id:       b.partner_id ?? null,
      partner_name:     b.partner_name ?? null,
      partner_phone:    b.partner_phone ?? null,
      otp_code:         b.otp_plaintext ?? null,
      duration_minutes: b.duration_minutes,
      started_at:       b.started_at?.toISOString() ?? null,
      total_price:      parseFloat(b.total_price as unknown as string),
    });
  } catch (err) {
    console.error('booking status GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
