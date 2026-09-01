import { NextRequest, NextResponse } from 'next/server';
import { requireMobileAuth } from '@/lib/mobileAuth';
import { query } from '@/lib/db';
import Razorpay from 'razorpay';

/**
 * POST /api/partner/wallet/topup/create
 * Create a Razorpay order for wallet topup
 */
export async function POST(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'partner');
    if (authError) return authError;

    const body = await req.json();
    const amount = parseFloat(body.amount);

    // Validate amount
    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Valid amount is required' },
        { status: 400 }
      );
    }

    // Minimum topup amount
    const MIN_TOPUP = 10;
    if (amount < MIN_TOPUP) {
      return NextResponse.json(
        { error: `Minimum topup amount is ₹${MIN_TOPUP}` },
        { status: 400 }
      );
    }

    // Get Razorpay credentials from settings
    const settings = await query<{ key_name: string; value: string }[]>(
      `SELECT key_name, value FROM settings 
       WHERE key_name IN ('razorpay_mode', 'razorpay_key_id_test', 'razorpay_key_secret_test', 
                          'razorpay_key_id_live', 'razorpay_key_secret_live')`
    );

    const settingsMap = settings.reduce((acc, s) => {
      acc[s.key_name] = s.value;
      return acc;
    }, {} as Record<string, string>);

    const mode = settingsMap['razorpay_mode'] || 'test';
    const keyId = mode === 'live' 
      ? settingsMap['razorpay_key_id_live'] 
      : settingsMap['razorpay_key_id_test'];
    const keySecret = mode === 'live'
      ? settingsMap['razorpay_key_secret_live']
      : settingsMap['razorpay_key_secret_test'];

    if (!keyId || !keySecret) {
      console.error('Razorpay credentials not configured');
      return NextResponse.json(
        { error: 'Payment gateway not configured' },
        { status: 500 }
      );
    }

    // Initialize Razorpay
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      receipt: `topup_${payload.userId}_${Date.now()}`,
      notes: {
        partner_id: payload.userId.toString(),
        type: 'wallet_topup',
      },
    });

    // Save topup record in database
    await query(
      `INSERT INTO wallet_topups (partner_id, amount, razorpay_order_id, status)
       VALUES (?, ?, ?, 'pending')`,
      [payload.userId, amount, order.id]
    );

    return NextResponse.json({
      success: true,
      order_id: order.id,
      amount: amount,          // rupees – Flutter converts to paise
      currency: 'INR',
      razorpay_key: keyId,
    });
  } catch (err) {
    console.error('Create topup order error:', err);
    return NextResponse.json(
      { error: 'Failed to create payment order' },
      { status: 500 }
    );
  }
}
