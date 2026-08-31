import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { getClientIp } from '@/lib/activityLogger';
import { notifyAdmins } from '@/lib/notificationHelper';

export async function POST(req: NextRequest) {
  try {
    const { email, password, reason } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Rate limit: max 5 attempts per IP per 15 minutes
    // This prevents brute-force attacks and email enumeration via timing
    const ip = getClientIp(req) ?? 'unknown';
    const recentAttempts = await query<{ cnt: number }[]>(
      `SELECT COUNT(*) AS cnt FROM delete_account_requests
       WHERE ip_address = ? AND created_at >= NOW() - INTERVAL 15 MINUTE`,
      [ip]
    );
    if ((recentAttempts[0]?.cnt ?? 0) >= 5) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const users = await query<{ id: number; password: string; name: string }[]>(
      `SELECT id, password, name FROM users WHERE email = ? AND deleted_at IS NULL AND status != 'banned'`,
      [email]
    );

    // Use a constant-time response to prevent email enumeration.
    // Always run bcrypt.compare even if user not found (against a dummy hash).
    const DUMMY_HASH = '$2a$12$invalidhashfortimingprotectiononly000000000000000000000';
    const storedHash = users[0]?.password ?? DUMMY_HASH;
    const valid = await bcrypt.compare(password, storedHash);

    if (users.length === 0 || !valid) {
      // Same error message whether email doesn't exist or password is wrong
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const user = users[0];
    if (!user.password) {
      return NextResponse.json({ error: 'Account uses social login. Contact support.' }, { status: 400 });
    }

    // Check for existing pending request
    const existing = await query<{ id: number }[]>(
      `SELECT id FROM delete_account_requests WHERE email = ? AND status = 'pending' AND deleted_at IS NULL`,
      [email]
    );
    if (existing.length > 0) {
      return NextResponse.json({ error: 'A deletion request is already pending for this account' }, { status: 409 });
    }

    await query(
      `INSERT INTO delete_account_requests (email, reason, status, ip_address) VALUES (?, ?, 'pending', ?)`,
      [email, reason || null, ip]
    );

    // Send push notification to admins about delete request
    console.log(`[NOTIFY] Account deletion request: ${email}, User: ${user.name}, Reason: ${reason || 'Not provided'}`);
    await notifyAdmins(
      'notify_delete_request',
      'Account Deletion Request',
      `User ${user.name} (${email}) has requested account deletion`,
      { type: 'delete_request', user_id: user.id.toString(), email, name: user.name, reason: reason || 'Not provided' },
      'alerts'
    );

    return NextResponse.json({
      success: true,
      message: 'Your account deletion request has been submitted. We will process it within 7 business days.',
    });
  } catch (err) {
    console.error('Delete account error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
