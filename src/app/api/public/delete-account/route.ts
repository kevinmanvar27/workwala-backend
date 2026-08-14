import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { email, password, reason } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const users = await query<{ id: number; password: string; name: string }[]>(
      `SELECT id, password, name FROM users WHERE email = ? AND deleted_at IS NULL AND status != 'banned'`,
      [email]
    );

    if (users.length === 0) {
      return NextResponse.json({ error: 'No account found with this email' }, { status: 404 });
    }

    const user = users[0];
    if (!user.password) {
      return NextResponse.json({ error: 'Account uses social login. Contact support.' }, { status: 400 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
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
      `INSERT INTO delete_account_requests (email, reason, status) VALUES (?, ?, 'pending')`,
      [email, reason || null]
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
