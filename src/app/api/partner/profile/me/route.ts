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
      id_front: string | null;
      id_back: string | null;
      bank_doc: string | null;
    }[]>(
      `SELECT p.id, p.name, p.phone, p.gender, p.language, p.categories,
              p.team_option, p.vehicle_type, p.status,
              p.rating, p.balance,
              pd.selfie, pd.id_front, pd.id_back,
              pbd.document_path AS bank_doc
       FROM partners p
       LEFT JOIN partner_documents pd ON pd.partner_id = p.id
       LEFT JOIN partner_bank_documents pbd ON pbd.partner_id = p.id
       WHERE p.id = ? AND p.deleted_at IS NULL
       LIMIT 1`,
      [payload.userId]
    );

    if (partners.length === 0) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const partner = partners[0];
    const profileComplete = !!(partner.name && partner.name.trim().length > 0);

    // Return the raw relative paths — Flutter prepends its own baseUrl.
    const selfiePath = partner.selfie ?? null;
    const idFrontPath = partner.id_front ?? null;
    const idBackPath = partner.id_back ?? null;
    const bankDocPath = partner.bank_doc ?? null;

    // ── Today's earnings & jobs — sourced directly from the bookings table ──
    // Digital-only (UPI / wallet / card / online) — these go to the partner's
    // withdrawable balance. Cash payments are collected in hand and must NOT
    // appear in the digital balance or today_earnings figure.
    const [earningsRow] = await query<{
      today_earnings: number;
      today_cash_earnings: number;
      today_jobs: number;
    }[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN LOWER(COALESCE(payment_method,'')) != 'cash' THEN total_price ELSE 0 END), 0) AS today_earnings,
         COALESCE(SUM(CASE WHEN LOWER(COALESCE(payment_method,'')) =  'cash' THEN total_price ELSE 0 END), 0) AS today_cash_earnings,
         COUNT(*)                                                                                              AS today_jobs
       FROM bookings
       WHERE partner_id   = ?
         AND status       = 'completed'
         AND deleted_at   IS NULL
         AND DATE(completed_at) = CURDATE()`,
      [partner.id]
    );

    const todayEarnings     = Number(earningsRow?.today_earnings      ?? 0);
    const todayCashEarnings = Number(earningsRow?.today_cash_earnings  ?? 0);
    const todayJobs         = Number(earningsRow?.today_jobs           ?? 0);

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
      today_earnings:      todayEarnings,
      today_cash_earnings: todayCashEarnings,
      today_jobs:          todayJobs,
      selfie_url:      selfiePath,
      id_front_url:    idFrontPath,
      id_back_url:     idBackPath,
      bank_doc_url:    bankDocPath,
    });
  } catch (err) {
    console.error('profile/me error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
