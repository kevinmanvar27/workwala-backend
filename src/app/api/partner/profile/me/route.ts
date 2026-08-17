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

    // Today's earnings — sum from partner_earnings if table exists, else 0
    let todayEarnings = 0;
    let todayJobs = 0;
    try {
      const [earningsRow] = await query<{ total: number; jobs: number }[]>(
        `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS jobs
         FROM partner_earnings
         WHERE partner_id = ? AND DATE(created_at) = CURDATE()`,
        [partner.id]
      );
      todayEarnings = Number(earningsRow?.total ?? 0);
      todayJobs     = Number(earningsRow?.jobs  ?? 0);
    } catch {
      // table doesn't exist yet — return zeros
    }

    return NextResponse.json({
      success: true,
      profile_complete: profileComplete,
      partner_status: partner.status,
      name:           partner.name    ?? '',
      phone:          partner.phone,
      gender:         partner.gender  ?? '',
      language:       partner.language ?? '',
      categories:     (() => { try { return JSON.parse(partner.categories || '[]'); } catch { return []; } })(),
      team_option:    partner.team_option  ?? '',
      vehicle_type:   partner.vehicle_type ?? '',
      rating:         partner.rating  ?? 0,
      balance:        partner.balance ?? 0,
      today_earnings: todayEarnings,
      today_jobs:     todayJobs,
      selfie_url:     selfiePath,
    });
  } catch (err) {
    console.error('profile/me error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
