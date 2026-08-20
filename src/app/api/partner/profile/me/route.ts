import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';

// GET /api/partner/profile/me
// Returns partner profile data used by splash screen + dashboard.
export async function GET(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'partner');
    if (authError) return authError;

    const partners = await query<{
      id: number;
      name: string | null;
      phone: string;
      gender: string | null;
      language: string | null;
      categories: string | null;
      team_option: string | null;
      vehicle_type: string | null;
      status: string;
      rating: number | null;
      balance: number | null;
      selfie: string | null;
    }[]>(
      `SELECT p.id, p.name, p.phone, p.gender, p.language, p.categories,
              p.team_option, p.vehicle_type, p.status,
              p.rating, p.balance,
              pd.selfie
       FROM partners p
       LEFT JOIN partner_documents pd ON pd.partner_id = p.id
       WHERE p.id = ? AND p.deleted_at IS NULL
       LIMIT 1`,
      [payload.userId]
    );

    if (partners.length === 0) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const partner = partners[0];
    const profileComplete = !!(partner.name && partner.name.trim().length > 0);

    // Return the raw relative path — Flutter prepends its own baseUrl.
    const selfiePath = partner.selfie ?? null;

    // ── Today's earnings & jobs — sourced directly from the bookings table ──
    // Counts completed bookings for this partner where completed_at is today.
    // This is the single source of truth since there is no partner_earnings table.
    const [earningsRow] = await query<{ today_earnings: number; today_jobs: number }[]>(
      `SELECT
         COALESCE(SUM(total_price), 0) AS today_earnings,
         COUNT(*)                       AS today_jobs
       FROM bookings
       WHERE partner_id   = ?
         AND status       = 'completed'
         AND deleted_at   IS NULL
         AND DATE(completed_at) = CURDATE()`,
      [partner.id]
    );

    const todayEarnings = Number(earningsRow?.today_earnings ?? 0);
    const todayJobs     = Number(earningsRow?.today_jobs     ?? 0);

    // ── Total (all-time) earnings — used as the wallet balance ──────────────
    // The partners.balance column is credited per booking in the complete route,
    // so it already reflects cumulative earnings. Use it directly.
    const balance = Number(partner.balance ?? 0);

    return NextResponse.json({
      success:         true,
      profile_complete: profileComplete,
      partner_status:  partner.status,
      name:            partner.name    ?? '',
      phone:           partner.phone,
      gender:          partner.gender  ?? '',
      language:        partner.language ?? '',
      categories:      (() => { try { return JSON.parse(partner.categories || '[]'); } catch { return []; } })(),
      team_option:     partner.team_option  ?? '',
      vehicle_type:    partner.vehicle_type ?? '',
      rating:          partner.rating  ?? 0,
      balance,
      today_earnings:  todayEarnings,
      today_jobs:      todayJobs,
      selfie_url:      selfiePath,
    });
  } catch (err) {
    console.error('profile/me error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
