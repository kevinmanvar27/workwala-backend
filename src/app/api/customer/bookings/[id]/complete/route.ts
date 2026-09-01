import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';
import { notifyAdmins, notifyPartner, notifyCustomer } from '@/lib/notificationHelper';
import { creditPartnerWallet, calculateTaskFees, getPartnerWalletBalance } from '@/lib/walletHelper';

// Reads Razorpay key secret from DB settings, falling back to .env.local
async function getRazorpaySecret(): Promise<string> {
  try {
    const rows = await query<{ key_name: string; value: string }[]>(
      `SELECT key_name, value FROM settings
       WHERE key_name IN ('razorpay_mode','razorpay_key_secret_test','razorpay_key_secret_live')
         AND deleted_at IS NULL`
    );
    const cfg: Record<string, string> = {};
    rows.forEach((r) => (cfg[r.key_name] = r.value));

    const mode = cfg.razorpay_mode || 'test';
    if (mode === 'live') {
      return cfg.razorpay_key_secret_live || process.env.RAZORPAY_KEY_SECRET_LIVE || '';
    }
    return cfg.razorpay_key_secret_test || process.env.RAZORPAY_KEY_SECRET_TEST || '';
  } catch {
    return process.env.RAZORPAY_KEY_SECRET_TEST || process.env.RAZORPAY_KEY_SECRET_LIVE || '';
  }
}

// POST /api/customer/bookings/[id]/complete
// Customer confirms payment after work is done.
// Body (UPI/Razorpay): { payment_method: 'UPI', razorpay_payment_id, razorpay_order_id, razorpay_signature }
// Body (Cash):         { payment_method: 'Cash' }
// Body (Wallet):       { payment_method: 'Wallet' }
// Transitions booking status: payment_pending → completed
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

    const body = await req.json().catch(() => ({}));
    const paymentMethod: string = body.payment_method ?? 'Cash';

    // Fetch booking — must belong to this customer and be payment_pending
    const rows = await query<Array<{
      id: number;
      status: string;
      total_price: string;
      partner_id: number | null;
      razorpay_order_id: string | null;
    }>>(
      `SELECT b.id, b.status, b.total_price, b.partner_id, b.razorpay_order_id
       FROM bookings b
       WHERE b.id = ? AND b.customer_id = ? AND b.deleted_at IS NULL
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

    const totalPrice = parseFloat(booking.total_price);

    // ── UPI / Razorpay — verify signature ────────────────────────────────────
    if (paymentMethod === 'UPI') {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = body;

      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        return NextResponse.json(
          { error: 'razorpay_payment_id, razorpay_order_id and razorpay_signature are required for UPI payment' },
          { status: 400 }
        );
      }

      // Verify HMAC-SHA256 signature
      const keySecret = await getRazorpaySecret();
      if (!keySecret) {
        return NextResponse.json({ error: 'Razorpay credentials not configured' }, { status: 503 });
      }

      const expectedSig = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (expectedSig !== razorpay_signature) {
        return NextResponse.json({ error: 'Payment signature verification failed' }, { status: 400 });
      }

      // Mark completed + store razorpay payment id
      await query(
        `UPDATE bookings
            SET status = 'completed',
                payment_method = 'UPI',
                razorpay_payment_id = ?,
                completed_at = NOW()
          WHERE id = ?`,
        [razorpay_payment_id, bookingId]
      );

      // Notify on successful UPI payment
      console.log(`[NOTIFY] UPI payment successful: Booking ${bookingId}, Amount: ₹${totalPrice}`);
      await notifyAdmins(
        'notify_payment',
        'Payment Successful',
        `UPI payment of ₹${totalPrice} received for booking #${bookingId}`,
        { type: 'payment_success', booking_id: bookingId.toString(), payment_method: 'UPI', amount: totalPrice.toString() },
        'user-notifications'
      );
    }

    // ── Wallet payment — deduct from customer wallet ──────────────────────────
    else if (paymentMethod === 'Wallet') {
      // Check customer has enough balance
      const custRows = await query<Array<{ wallet_balance: string }>>(
        `SELECT wallet_balance FROM customers WHERE id = ? LIMIT 1`,
        [payload.userId]
      );
      const walletBalance = parseFloat(custRows[0]?.wallet_balance ?? '0');

      if (walletBalance < totalPrice) {
        return NextResponse.json(
          { error: `Insufficient wallet balance. Available: ₹${walletBalance.toFixed(2)}, Required: ₹${totalPrice.toFixed(2)}` },
          { status: 400 }
        );
      }

      // Deduct from customer wallet
      await query(
        `UPDATE customers SET wallet_balance = wallet_balance - ? WHERE id = ?`,
        [totalPrice, payload.userId]
      );

      // Mark booking completed
      await query(
        `UPDATE bookings
            SET status = 'completed',
                payment_method = 'Wallet',
                completed_at = NOW()
          WHERE id = ?`,
        [bookingId]
      );

      // Notify on successful wallet payment
      console.log(`[NOTIFY] Wallet payment successful: Booking ${bookingId}, Amount: ₹${totalPrice}`);
      await notifyAdmins(
        'notify_payment',
        'Payment Successful',
        `Wallet payment of ₹${totalPrice} received for booking #${bookingId}`,
        { type: 'payment_success', booking_id: bookingId.toString(), payment_method: 'Wallet', amount: totalPrice.toString() },
        'user-notifications'
      );
    }

    // ── Cash — no online verification needed ─────────────────────────────────
    else {
      await query(
        `UPDATE bookings
            SET status = 'completed',
                payment_method = 'Cash',
                completed_at = NOW()
          WHERE id = ?`,
        [bookingId]
      );

      // Notify on cash payment
      console.log(`[NOTIFY] Cash payment confirmed: Booking ${bookingId}, Amount: ₹${totalPrice}`);
      await notifyAdmins(
        'notify_payment',
        'Payment Successful',
        `Cash payment of ₹${totalPrice} confirmed for booking #${bookingId}`,
        { type: 'payment_success', booking_id: bookingId.toString(), payment_method: 'Cash', amount: totalPrice.toString() },
        'user-notifications'
      );
    }

    // ── Credit partner earnings ───────────────────────────────────────────────
    // Use wallet system to properly handle fees and balance tracking
    if (booking.partner_id) {
      try {
        const paymentType = paymentMethod === 'Cash' ? 'cash' : 'online';
        const walletResult = await creditPartnerWallet(
          booking.partner_id,
          bookingId,
          totalPrice,
          paymentType
        );

        console.log(`[WALLET] Partner ${booking.partner_id} credited: ${paymentType} payment`, walletResult);

        // Check if wallet went negative (for cash payments)
        const walletBalance = await getPartnerWalletBalance(booking.partner_id);
        if (walletBalance.isNegative) {
          // Notify partner about negative balance
          await notifyPartner(
            booking.partner_id,
            'Low Wallet Balance',
            `Your wallet balance is ₹${walletBalance.totalBalance.toFixed(2)}. Please add money to continue accepting jobs.`,
            { 
              type: 'low_balance', 
              balance: walletBalance.totalBalance.toString(),
              action_required: 'true' 
            },
            'partner-notifications'
          );
        }
      } catch (walletError) {
        console.error('[WALLET] Error crediting partner:', walletError);
        // Non-fatal — don't fail the payment confirmation
      }
    }

    // Send push notifications about booking completion
    console.log(`[NOTIFY] Booking completed: ID ${bookingId}, Payment: ${paymentMethod}, Amount: ₹${totalPrice}`);
    
    // Notify customer that payment was confirmed
    await notifyCustomer(
      payload.userId,
      'Payment Confirmed',
      `Your payment of ₹${totalPrice} for booking #${bookingId} has been confirmed. Thank you!`,
      { type: 'payment_confirmed', booking_id: bookingId.toString(), amount: totalPrice.toString(), payment_method: paymentMethod },
      'user-notifications'
    );

    // Notify partner about payment received (all payment methods)
    if (booking.partner_id) {
      await notifyPartner(
        booking.partner_id,
        'Payment Received',
        `₹${totalPrice} ${paymentMethod === 'Cash' ? 'cash' : ''} payment received for booking #${bookingId}`.trim(),
        { type: 'payment_received', booking_id: bookingId.toString(), amount: totalPrice.toString(), payment_method: paymentMethod },
        'partner-notifications'
      );
    }

    // Notify admins about booking completion
    await notifyAdmins(
      'notify_booking_completed',
      'Booking Completed',
      `Booking #${bookingId} completed with ${paymentMethod} payment - ₹${totalPrice}`,
      { 
        type: 'booking_completed', 
        booking_id: bookingId.toString(), 
        payment_method: paymentMethod,
        amount: totalPrice.toString(),
        partner_id: booking.partner_id?.toString() || 'N/A'
      },
      'user-notifications'
    );

    return NextResponse.json({
      success: true,
      booking_id: bookingId,
      status: 'completed',
      payment_method: paymentMethod,
      total_price: totalPrice,
    });
  } catch (err) {
    console.error('[customer/bookings/complete] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
