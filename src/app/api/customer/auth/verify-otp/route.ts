import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { signToken } from '@/lib/jwt';
import { hashOtp } from '@/lib/otpUtils';

// ── Bypass OTP ────────────────────────────────────────────────────────────────
// OTP "123456" always passes for:
//   1. Non-production environments (any phone) — for local dev/testing.
//   2. The REVIEW_PHONE number in production — for App Store / Play Store reviewers.
//   3. ANY phone number if ALLOW_BYPASS_FOR_ALL is enabled (testing only!)
const BYPASS_OTP = '123456';
const REVIEW_PHONE = process.env.REVIEW_PHONE ?? '';
const ALLOW_BYPASS_FOR_ALL = process.env.ALLOW_BYPASS_FOR_ALL === 'true';

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

    // ── Bypass: skip DB OTP check for dev env OR review phone OR global bypass ─────────────────
    const isDevBypass = process.env.NODE_ENV !== 'production' && otp === BYPASS_OTP;
    const isReviewBypass = REVIEW_PHONE.length === 10 && phone === REVIEW_PHONE && otp === BYPASS_OTP;
    const isGlobalBypass = ALLOW_BYPASS_FOR_ALL && otp === BYPASS_OTP;
    
    if (isDevBypass || isReviewBypass || isGlobalBypass) {
      const customers = await query<{ id: number; name: string | null; token_version: number }[]>(
        `SELECT id, name, token_version FROM customers WHERE phone = ? AND deleted_at IS NULL LIMIT 1`,
        [phone]
      );
      let customerId: number;
      let isNewUser: boolean;
      let tokenVersion: number;
      if (customers.length === 0) {
        const result = await query<{ insertId: number }>(
          `INSERT INTO customers (phone) VALUES (?)`, [phone]
        );
        customerId = result.insertId; isNewUser = true; tokenVersion = 1;
      } else {
        customerId = customers[0].id; 
        // Check if profile is incomplete (name is null or empty)
        isNewUser = !customers[0].name || customers[0].name.trim() === '';
        tokenVersion = customers[0].token_version ?? 1;
      }
      const token = signToken({ userId: customerId, email: phone, roleSlug: 'customer', roleName: 'Customer', tokenVersion });
      const bypassType = isGlobalBypass ? 'global bypass' : (isReviewBypass ? 'review account' : 'dev');
      console.log(`[BYPASS] Customer login for ${phone} (${bypassType})`);
      return NextResponse.json({ success: true, token, customer_id: customerId, is_new_user: isNewUser });
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

    // Compare HMAC hash of submitted OTP against stored hash
    if (otpRecord.otp !== hashOtp(otp)) {
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
    const customers = await query<{ id: number; name: string | null; token_version: number }[]>(
      `SELECT id, name, token_version FROM customers WHERE phone = ? AND deleted_at IS NULL LIMIT 1`,
      [phone]
    );

    let customerId: number;
    let isNewUser: boolean;
    let tokenVersion: number;

    if (customers.length === 0) {
      // Brand new customer — create shell row (token_version defaults to 1)
      const result = await query<{ insertId: number }>(
        `INSERT INTO customers (phone) VALUES (?)`,
        [phone]
      );
      customerId   = result.insertId;
      isNewUser    = true;
      tokenVersion = 1;
    } else {
      customerId   = customers[0].id;
      // Check if profile is incomplete (name is null or empty)
      isNewUser    = !customers[0].name || customers[0].name.trim() === '';
      tokenVersion = customers[0].token_version ?? 1;
    }

    // Embed tokenVersion so the server can revoke tokens by incrementing it
    const token = signToken({
      userId:       customerId,
      email:        phone,
      roleSlug:     'customer',
      roleName:     'Customer',
      tokenVersion,
    });

    return NextResponse.json({
      success:     true,
      token,
      customer_id: customerId,
      is_new_user: isNewUser,
    });
  } catch (err) {
    console.error('customer verify-otp error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
