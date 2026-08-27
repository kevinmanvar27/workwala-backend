import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';

// GET /api/admin/customers
export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, 'users.view');
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    const searchWild = `%${search}%`;

    const customers = await query<{
      id: number;
      name: string;
      phone: string;
      fcm_token: string | null;
      created_at: string;
    }[]>(
      `SELECT id, name, phone, fcm_token, created_at
       FROM customers
       WHERE deleted_at IS NULL
         AND (name LIKE ? OR phone LIKE ?)
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [searchWild, searchWild, limit, offset]
    );

    const [total] = await query<{ count: number }[]>(
      `SELECT COUNT(*) as count
       FROM customers
       WHERE deleted_at IS NULL
         AND (name LIKE ? OR phone LIKE ?)`,
      [searchWild, searchWild]
    );

    return NextResponse.json({
      customers,
      total: total.count,
      page,
      limit
    });
  } catch (err) {
    console.error('Customers GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
