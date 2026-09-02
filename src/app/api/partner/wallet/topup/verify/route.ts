import { NextRequest, NextResponse } from 'next/server';
import { requireMobileAuth } from '@/lib/mobileAuth';
import { query } from '@/lib/db';
import { recordWalletTransaction } from '@/lib/walletHelper';
import crypto from 'crypto';

/**
 * POST /api/partner/wallet/topup/verify
 * Verify Razorpay payment and credit wallet
 */
export async function POST(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'partner');
    if (authError) return authError;

    const body = await req.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: 'Missing payment details' },
        { status: 400 }
      );
    }

    // Get topup record
    const [topup] = await query<{
      id: number;
      partner_id: number;
      amount: number;
      status: string;
    }[]>(
      `SELECT id, partner_id, amount, status 
       FROM wallet_topups 
       WHERE razorpay_order_id = ? AND partner_id = ?`,
      [razorpay_order_id, payload.userId]
    );

    if (!topup) {
      return NextResponse.json(
        { error: 'Topup order not found' },
        { status: 404 }
      );
    }

    if (topup.status === 'completed') {
      return NextResponse.json(
        { error: 'Payment already processed' },
        { status: 400 }
      );
    }

    // Get Razorpay secret for signature verification
    const settings = await query<{ key_name: string; value: string }[]>(
      `SELECT key_name, value FROM settings 
       WHERE key_name IN ('razorpay_mode', 'razorpay_key_secret_test', 'razorpay_key_secret_live')`
    );

    const settingsMap = settings.reduce((acc, s) => {
      acc[s.key_name] = s.value;
      return acc;
    }, {} as Record<string, string>);

    const mode = settingsMap['razorpay_mode'] || 'test';
    const keySecret = mode === 'live'
      ? settingsMap['razorpay_key_secret_live']
      : settingsMap['razorpay_key_secret_test'];

    if (!keySecret) {
      console.error('Razorpay secret not configured');
      return NextResponse.json(
        { error: 'Payment verification failed' },
        { status: 500 }
      );
    }

    // Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      // Mark as failed
      await query(
        `UPDATE wallet_topups 
         SET status = 'failed', failure_reason = 'Invalid signature'
         WHERE id = ?`,
        [topup.id]
      );

      return NextResponse.json(
        { error: 'Payment verification failed' },
        { status: 400 }
      );
    }

    // Signature is valid - credit wallet
    await recordWalletTransaction(
      payload.userId,
      'topup',
      topup.amount,
      `Wallet topup via Razorpay`,
      {
        referenceType: 'topup',
        referenceId: topup.id,
        paymentMethod: 'razorpay',
        metadata: {
          razorpay_order_id,
          razorpay_payment_id,
        },
      }
    );

    // Update topup status
    await query(
      `UPDATE wallet_topups 
       SET status = 'completed', 
           razorpay_payment_id = ?,
           razorpay_signature = ?,
           completed_at = NOW()
       WHERE id = ?`,
      [razorpay_payment_id, razorpay_signature, topup.id]
    );

    // Get updated balance
    const [partner] = await query<{ balance: number }[]>(
      `SELECT balance FROM partners WHERE id = ?`,
      [payload.userId]
    );

    return NextResponse.json({
      success: true,
      message: 'Payment successful! Wallet credited.',
      amount: Number(topup.amount),
      new_balance: Number(partner?.balance || 0),
    });
  } catch (err) {
    console.error('Verify topup payment error:', err);
    return NextResponse.json(
      { error: 'Failed to verify payment' },
      { status: 500 }
    );
  }
}
