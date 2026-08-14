import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { signToken } from '@/lib/jwt';

// POST /api/customer/auth/verify-otp
export async function POST(req: NextRequest) {
  try {
    const { phone, otp } = await req.json();

    if (!phone || !/^\d{10}$/.test(phone)) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }
    if (!otp || otp.length !== 6) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
    }

    // Find the latest unused, non-expired OTP for this phone
    const otpRows = await query<{
      id: number;
      otp: string;
      expires_at: Date;
      used: number;
      attempts: number;
    }[]>(
      `SELECT id, otp, expires_at, used, attempts FROM customer_otps
       WHERE phone = ? AND used = 0 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [phone]
    );

    if (otpRows.length === 0) {
      return NextResponse.json({ error: 'OTP expired or not found. Please request a new one.' }, { status: 400 });
    }

    const otpRecord = otpRows[0];

    // Max 5 wrong attempts
    if (otpRecord.attempts >= 5) {
      await query(`UPDATE customer_otps SET used = 1 WHERE id = ?`, [otpRecord.id]);
      return NextResponse.json({ error: 'Too many wrong attempts. Please request a new OTP.' }, { status: 400 });
    }

    if (otpRecord.otp !== otp) {
      await query(`UPDATE customer_otps SET attempts = attempts + 1 WHERE id = ?`, [otpRecord.id]);
      const remaining = 5 - (otpRecord.attempts + 1);
      return NextResponse.json(
        { error: `Incorrect OTP. ${remaining} attempt(s) remaining.` },
        { status: 400 }
      );
    }

    // Mark OTP as used
    await query(`UPDATE customer_otps SET used = 1 WHERE id = ?`, [otpRecord.id]);

    // Check if customer already exists
    const customers = await query<{ id: number; name: string | null }[]>(
      `SELECT id, name FROM customers WHERE phone = ? AND deleted_at IS NULL LIMIT 1`,
      [phone]
    );

    let customerId: number;
    let isNewUser: boolean;

    if (customers.length === 0) {
      // Brand new customer — create shell row
      const result = await query<{ insertId: number }>(
        `INSERT INTO customers (phone) VALUES (?)`,
        [phone]
      );
      customerId = result.insertId;
      isNewUser = true;
    } else {
      customerId = customers[0].id;
      isNewUser = false;
    }

    // Sign JWT — roleSlug 'customer', email field reused for phone
    const token = signToken({
      userId: customerId,
      email: phone,
      roleSlug: 'customer',
      roleName: 'Customer',
    });

    return NextResponse.json({
      success: true,
      token,
      customer_id: customerId,
      is_new_user: isNewUser,
    });
  } catch (err) {
    console.error('customer verify-otp error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
