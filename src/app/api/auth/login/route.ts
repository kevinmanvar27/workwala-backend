import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { signToken } from '@/lib/jwt';
import { logActivity, getClientIp } from '@/lib/activityLogger';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const users = await query<{
      id: number; name: string; email: string; password: string;
      role_id: number; role_name: string; role_slug: string; status: string;
    }[]>(
      `SELECT u.id, u.name, u.email, u.password, u.role_id, u.status,
              r.name as role_name, r.slug as role_slug
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.email = ? AND u.deleted_at IS NULL`,
      [email]
    );

    if (users.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const user = users[0];

    if (user.status === 'banned') {
      return NextResponse.json({ error: 'Your account has been banned' }, { status: 403 });
    }
    if (user.status === 'inactive') {
      return NextResponse.json({ error: 'Your account is inactive' }, { status: 403 });
    }
    if (!user.password) {
      return NextResponse.json({ error: 'Please use social login' }, { status: 400 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      roleSlug: user.role_slug || 'user',
      roleName: user.role_name || 'User',
    });

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role_name },
    });

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    await logActivity({
      userId: user.id, userName: user.name,
      action: 'Login', module: 'auth',
      description: `Logged in as ${user.role_name || 'User'}`,
      ipAddress: getClientIp(req),
    });

    return response;
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
