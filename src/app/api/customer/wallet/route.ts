import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';

// GET /api/customer/wallet
// Returns the customer's current wallet balance.
export async function GET(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'customer');
    if (authError) return authError;

    const rows = await query<Array<{ wallet_balance: string }>>(
      `SELECT wallet_balance FROM customers WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [payload.userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      wallet_balance: parseFloat(rows[0].wallet_balance),
    });
  } catch (err) {
    console.error('[customer/wallet] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
