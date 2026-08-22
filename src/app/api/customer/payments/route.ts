import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';

// GET /api/customer/payments — get all completed payments for the customer
export async function GET(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'customer');
    if (authError) return authError;

    // Get all completed bookings with payment information
    const payments = await query<{
      id: number;
      booking_id: number;
      service_name: string;
      partner_name: string | null;
      amount: string;
      payment_method: string | null;
      payment_date: Date;
      status: string;
      razorpay_payment_id: string | null;
    }[]>(
      `SELECT b.id,
              b.id AS booking_id,
              s.name AS service_name,
              p.name AS partner_name,
              b.total_price AS amount,
              b.payment_method,
              COALESCE(b.completed_at, b.updated_at) AS payment_date,
              b.status,
              b.razorpay_payment_id
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       LEFT JOIN partners p ON p.id = b.partner_id
       WHERE b.customer_id = ?
         AND b.status IN ('completed', 'payment_pending')
         AND b.deleted_at IS NULL
       ORDER BY payment_date DESC`,
      [payload.userId]
    );

    return NextResponse.json({
      success: true,
      payments: payments.map(p => ({
        id: p.id,
        booking_id: p.booking_id,
        service_name: p.service_name,
        partner_name: p.partner_name,
        amount: parseFloat(p.amount),
        payment_method: p.payment_method || 'Cash',
        payment_date: p.payment_date,
        status: p.status === 'completed' ? 'completed' : 'pending',
        transaction_id: p.razorpay_payment_id,
      })),
    });
  } catch (err) {
    console.error('customer payments GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
