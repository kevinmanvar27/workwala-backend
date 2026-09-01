import { NextRequest, NextResponse } from 'next/server';
import { requireMobileAuth } from '@/lib/mobileAuth';
import { getWalletTransactions } from '@/lib/walletHelper';

/**
 * GET /api/partner/wallet/transactions
 * Get partner's wallet transaction history with pagination
 */
export async function GET(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'partner');
    if (authError) return authError;

    // Get pagination params from query
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Get transactions
    const transactions = await getWalletTransactions(payload.userId, limit, offset);

    return NextResponse.json({
      success: true,
      transactions,
      pagination: {
        page,
        limit,
        has_more: transactions.length === limit,
      },
    });
  } catch (err) {
    console.error('Get wallet transactions error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
