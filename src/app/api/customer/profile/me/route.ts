import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';

// GET /api/customer/profile/me
export async function GET(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'customer');
    if (authError) return authError;

    const customers = await query<{
      id: number;
      name: string | null;
      phone: string;
      language: string | null;
      avatar_url: string | null;
    }[]>(
      `SELECT id, name, phone, language, avatar_url
       FROM customers
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [payload.userId]
    );

    if (customers.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const customer = customers[0];

    return NextResponse.json({
      success: true,
      id: customer.id,
      name: customer.name ?? '',
      phone: customer.phone,
      language: customer.language ?? '',
      avatar_url: customer.avatar_url ?? null,
    });
  } catch (err) {
    console.error('customer profile/me error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
