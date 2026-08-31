import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';

// GET /api/partner/payments
// Returns all completed bookings for the authenticated partner, including
// the payment method (Cash / UPI / Wallet) and amount.
// Also returns withdrawal request history so the partner can see everything
// in one place.
export async function GET(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'partner');
    if (authError) return authError;

    // ── Completed bookings (earnings) ────────────────────────────────────────
    const bookings = await query<Array<{
      id: number;
      booking_id: number;
      service_name: string;
      customer_name: string | null;
      amount: string;
      payment_method: string | null;
      payment_date: Date;
      status: string;
      razorpay_payment_id: string | null;
    }>>(
      `SELECT b.id,
              b.id                          AS booking_id,
              COALESCE(cat.name, s.name)    AS service_name,
              COALESCE(c.name, c.phone)     AS customer_name,
              b.total_price                 AS amount,
              b.payment_method,
              COALESCE(b.completed_at, b.updated_at) AS payment_date,
              b.status,
              b.razorpay_payment_id
       FROM   bookings b
       JOIN   services  s   ON s.id  = b.service_id
       LEFT JOIN categories cat ON cat.id = s.category_id AND cat.deleted_at IS NULL
       LEFT JOIN customers c   ON c.id  = b.customer_id
       WHERE  b.partner_id = ?
         AND  b.status     = 'completed'
         AND  b.deleted_at IS NULL
       ORDER  BY payment_date DESC`,
      [payload.userId]
    );

    // ── Withdrawal requests ──────────────────────────────────────────────────
    const withdrawals = await query<Array<{
      id: number;
      amount: number;
      status: string;
      request_date: string;
      processed_date: string | null;
      admin_notes: string | null;
      partner_notes: string | null;
      transaction_id: string | null;
    }>>(
      `SELECT id, amount, status, request_date, processed_date,
              admin_notes, partner_notes, transaction_id
       FROM   withdrawal_requests
       WHERE  partner_id = ? AND deleted_at IS NULL
       ORDER  BY request_date DESC
       LIMIT  100`,
      [payload.userId]
    );

    return NextResponse.json({
      success: true,
      bookings: bookings.map(b => ({
        id:             b.id,
        booking_id:     b.booking_id,
        service_name:   b.service_name,
        customer_name:  b.customer_name ?? 'Customer',
        amount:         parseFloat(b.amount),
        payment_method: b.payment_method ?? 'Cash',
        payment_date:   b.payment_date,
        status:         b.status,
        transaction_id: b.razorpay_payment_id ?? null,
      })),
      withdrawals: withdrawals.map(w => ({
        ...w,
        amount: Number(w.amount),
      })),
    });
  } catch (err) {
    console.error('[partner/payments GET] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
