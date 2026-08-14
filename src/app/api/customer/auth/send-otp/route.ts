import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendOtp, getOtpExpiryMinutes } from '@/lib/msg91';

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/customer/auth/send-otp
export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();

    if (!phone || !/^\d{10}$/.test(phone)) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    // Rate limit: max 3 OTP requests per phone in the last 5 minutes
    const recentCount = await query<{ cnt: number }[]>(
      `SELECT COUNT(*) AS cnt FROM customer_otps
       WHERE phone = ? AND created_at >= NOW() - INTERVAL 5 MINUTE`,
      [phone]
    );
    if ((recentCount[0]?.cnt ?? 0) >= 3) {
      return NextResponse.json(
        { error: 'Too many OTP requests. Please wait 5 minutes.' },
        { status: 429 }
      );
    }

    const otp = generateOtp();
    const expiryMinutes = await getOtpExpiryMinutes();

    // Invalidate any existing unused OTPs for this phone
    await query(
      `UPDATE customer_otps SET used = 1 WHERE phone = ? AND used = 0`,
      [phone]
    );

    // Insert new OTP
    await query(
      `INSERT INTO customer_otps (phone, otp, expires_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [phone, otp, expiryMinutes]
    );

    const result = await sendOtp(phone, otp);

    if (!result.sent) {
      return NextResponse.json({ error: 'Failed to send OTP. Please try again.' }, { status: 500 });
    }

    const response: Record<string, unknown> = { success: true, message: 'OTP sent successfully' };
    // In dev mode, include the OTP in the response for easy testing
    if (result.devMode) {
      response.dev_otp = result.otp;
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error('customer send-otp error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
