import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { signToken } from '@/lib/jwt';

// POST /api/partner/auth/verify-otp
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
      `SELECT id, otp, expires_at, used, attempts FROM partner_otps
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
      await query(`UPDATE partner_otps SET used = 1 WHERE id = ?`, [otpRecord.id]);
      return NextResponse.json({ error: 'Too many wrong attempts. Please request a new OTP.' }, { status: 400 });
    }

    if (otpRecord.otp !== otp) {
      await query(`UPDATE partner_otps SET attempts = attempts + 1 WHERE id = ?`, [otpRecord.id]);
      const remaining = 5 - (otpRecord.attempts + 1);
      return NextResponse.json(
        { error: `Incorrect OTP. ${remaining} attempt(s) remaining.` },
        { status: 400 }
      );
    }

    // Mark OTP as used
    await query(`UPDATE partner_otps SET used = 1 WHERE id = ?`, [otpRecord.id]);

    // Check if partner already exists — fetch name + status to determine routing
    const partners = await query<{ id: number; name: string | null; status: string }[]>(
      `SELECT id, name, status FROM partners WHERE phone = ? AND deleted_at IS NULL LIMIT 1`,
      [phone]
    );

    let partnerId: number;
    let profileComplete: boolean;
    let partnerStatus: string;

    if (partners.length === 0) {
      // Brand new — create the shell row
      const result = await query<{ insertId: number }>(
        `INSERT INTO partners (phone, status) VALUES (?, 'pending')`,
        [phone]
      );
      partnerId = result.insertId;
      profileComplete = false;
      partnerStatus = 'pending';
    } else {
      partnerId = partners[0].id;
      partnerStatus = partners[0].status;
      // Profile is complete only if name has been filled in (submitted via profile/submit)
      profileComplete = !!(partners[0].name && partners[0].name.trim().length > 0);
    }

    // Sign JWT — roleSlug 'partner', email field reused for phone
    const token = signToken({
      userId: partnerId,
      email: phone,
      roleSlug: 'partner',
      roleName: 'Partner',
    });

    return NextResponse.json({
      success: true,
      token,
      partner_id: partnerId,
      // profile_complete: false  → go to CreateProfileStep1
      // profile_complete: true, partner_status: 'approved' → go to Dashboard
      // profile_complete: true, partner_status: 'pending'|'rejected' → go to ApplicationSubmitted
      profile_complete: profileComplete,
      partner_status: partnerStatus,
    });
  } catch (err) {
    console.error('verify-otp error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
