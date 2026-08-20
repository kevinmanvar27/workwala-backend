import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';

// Reads Razorpay credentials from the DB settings table (admin-configurable),
// falling back to .env.local values so local dev without a DB entry still works.
async function getRazorpayCredentials(): Promise<{ keyId: string; keySecret: string }> {
  try {
    const rows = await query<{ key_name: string; value: string }[]>(
      `SELECT key_name, value FROM settings
       WHERE key_name IN ('razorpay_mode','razorpay_key_id_test','razorpay_key_secret_test','razorpay_key_id_live','razorpay_key_secret_live')
         AND deleted_at IS NULL`
    );
    const cfg: Record<string, string> = {};
    rows.forEach((r) => (cfg[r.key_name] = r.value));

    const mode = cfg.razorpay_mode || 'test';
    if (mode === 'live') {
      return {
        keyId:     cfg.razorpay_key_id_live     || process.env.RAZORPAY_KEY_ID_LIVE     || '',
        keySecret: cfg.razorpay_key_secret_live || process.env.RAZORPAY_KEY_SECRET_LIVE || '',
      };
    }
    return {
      keyId:     cfg.razorpay_key_id_test     || process.env.RAZORPAY_KEY_ID_TEST     || '',
      keySecret: cfg.razorpay_key_secret_test || process.env.RAZORPAY_KEY_SECRET_TEST || '',
    };
  } catch {
    // DB unavailable — fall back to env
    return {
      keyId:     process.env.RAZORPAY_KEY_ID_TEST     || process.env.RAZORPAY_KEY_ID_LIVE     || '',
      keySecret: process.env.RAZORPAY_KEY_SECRET_TEST || process.env.RAZORPAY_KEY_SECRET_LIVE || '',
    };
  }
}

// POST /api/customer/bookings/[id]/create-order
// Creates a Razorpay order for UPI / online payment.
// Returns { order_id, amount, currency, key_id } to the Flutter app.
export async function POST(
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

    // Fetch booking — must belong to this customer and be in payment_pending state
    const rows = await query<Array<{
      id: number;
      status: string;
      total_price: string;
      razorpay_order_id: string | null;
    }>>(
      `SELECT id, status, total_price, razorpay_order_id
       FROM bookings
       WHERE id = ? AND customer_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [bookingId, payload.userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const booking = rows[0];

    if (booking.status !== 'payment_pending') {
      return NextResponse.json(
        { error: `Booking is in '${booking.status}' state, expected 'payment_pending'` },
        { status: 409 }
      );
    }

    const { keyId, keySecret } = await getRazorpayCredentials();

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: 'Razorpay credentials not configured on server' },
        { status: 503 }
      );
    }

    // Re-use existing order if already created (idempotent)
    if (booking.razorpay_order_id) {
      return NextResponse.json({
        success:  true,
        order_id: booking.razorpay_order_id,
        amount:   Math.round(parseFloat(booking.total_price) * 100), // paise
        currency: 'INR',
        key_id:   keyId,
      });
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

    const amountPaise = Math.round(parseFloat(booking.total_price) * 100);

    const order = await razorpay.orders.create({
      amount:   amountPaise,
      currency: 'INR',
      receipt:  `booking_${bookingId}`,
      notes:    { booking_id: String(bookingId), customer_id: String(payload.userId) },
    });

    // Persist order id so we can verify the payment later
    await query(
      `UPDATE bookings SET razorpay_order_id = ? WHERE id = ?`,
      [order.id, bookingId]
    );

    return NextResponse.json({
      success:  true,
      order_id: order.id,
      amount:   amountPaise,
      currency: 'INR',
      key_id:   keyId,
    });
  } catch (err) {
    console.error('[bookings/create-order] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
