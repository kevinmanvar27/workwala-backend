import { NextRequest, NextResponse } from 'next/server';
import { requireMobileAuth } from '@/lib/mobileAuth';
import {
  getPartnerWalletBalance,
  getWalletTransactions,
  getWalletStatistics,
  getWalletSettings,
  calculatePendingFees,
} from '@/lib/walletHelper';

/**
 * GET /api/partner/wallet
 * Get partner's wallet details including balance, statistics, and settings
 */
export async function GET(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'partner');
    if (authError) return authError;

    console.log(`📱 [Wallet API] Fetching wallet for partner ${payload.userId}`);

    // Get wallet balance
    const balance = await getPartnerWalletBalance(payload.userId);
    console.log(`💰 [Wallet API] Balance:`, balance);

    // Get pending fees (not yet deducted)
    const pendingFees = await calculatePendingFees(payload.userId);
    console.log(`💸 [Wallet API] Pending Fees:`, pendingFees);

    // Calculate available for withdrawal (balance - minimum - pending fees)
    const availableForWithdrawal = Math.max(
      0,
      balance.totalBalance - balance.minimumRequired - pendingFees.totalPendingFees
    );
    console.log(`✅ [Wallet API] Available for Withdrawal: ${availableForWithdrawal}`);

    // Get wallet statistics (this month)
    const statistics = await getWalletStatistics(payload.userId, 'month');

    // Get wallet settings
    const settings = await getWalletSettings();

    // Get recent transactions (last 10)
    const recentTransactions = await getWalletTransactions(payload.userId, 10, 0);

    return NextResponse.json({
      success: true,
      balance: {
        gross_earnings: pendingFees.grossEarnings,
        pending_platform_fees: pendingFees.platformFees,
        pending_task_fees: pendingFees.taskFees,
        total_pending_fees: pendingFees.totalPendingFees,
        total: balance.totalBalance,
        minimum_required: balance.minimumRequired,
        available_for_withdrawal: Number(availableForWithdrawal.toFixed(2)),
        is_below_minimum: balance.isBelowMinimum,
        is_negative: balance.isNegative,
      },
      statistics: {
        total_earnings: statistics.totalEarnings,
        platform_fees: statistics.platformFeesDeducted,
        task_fees: statistics.taskFeesDeducted,
        withdrawals: statistics.withdrawals,
        topups: statistics.topups,
        net_earnings: statistics.netEarnings,
      },
      settings: {
        minimum_balance: settings.minimumBalance,
        platform_fee_type: settings.platformFeeType,
        platform_fee_value: settings.platformFeeValue,
        task_fee: settings.taskFee,
      },
      recent_transactions: recentTransactions,
    });
  } catch (err) {
    console.error('Get wallet error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch wallet details' },
      { status: 500 }
    );
  }
}
