import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';

// GET /api/customer/bookings/active
// Returns the customer's most recent active booking (finding / matched / in_progress), or null.
// Used by the splash screen to restore the correct screen after app reopen.
export async function GET(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'customer');
    if (authError) return authError;

    const rows = await query<Array<{
      id: number;
      status: string;
      service_name: string;
      partner_id: number | null;
      partner_name: string | null;
      partner_phone: string | null;
      otp_plaintext: string | null;
      duration_minutes: number;
      started_at: Date | null;
      total_price: string;
    }>>(
      `SELECT b.id,
              b.status,
              COALESCE(cat.name, s.name)        AS service_name,
              b.partner_id,
              COALESCE(p.name, p.phone)         AS partner_name,
              p.phone                           AS partner_phone,
              b.otp_plaintext,
              b.duration_minutes,
              b.started_at,
              b.total_price
       FROM bookings b
       JOIN services s   ON s.id = b.service_id
       LEFT JOIN categories cat ON cat.id = s.category_id AND cat.deleted_at IS NULL
       LEFT JOIN partners p ON p.id = b.partner_id
       WHERE b.customer_id = ?
         AND b.status IN ('finding', 'matched', 'in_progress', 'payment_pending')
         AND b.deleted_at IS NULL
       ORDER BY b.updated_at DESC
       LIMIT 1`,
      [payload.userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ success: true, booking: null });
    }

    const b = rows[0];

    return NextResponse.json({
      success: true,
      booking: {
        id:            b.id,
        status:        b.status,           // 'finding' | 'matched' | 'in_progress' | 'payment_pending'
        service_name:  b.service_name,
        partner_id:    b.partner_id    ?? null,
        partner_name:  b.partner_name  ?? null,
        partner_phone: b.partner_phone ?? null,
        otp_code:      b.otp_plaintext ?? null,  // plaintext — shown to customer
        duration_minutes: b.duration_minutes,
        started_at:    b.started_at?.toISOString() ?? null,
        total_price:   parseFloat(b.total_price as unknown as string),
      },
    });
  } catch (err) {
    console.error('[customer/bookings/active] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
