import { query } from './db';

/**
 * Wallet Helper - Manages partner wallet operations
 * Handles balance calculations, fee deductions, and transaction tracking
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface WalletSettings {
  minimumBalance: number;
  platformFeeType: 'percentage' | 'fixed';
  platformFeeValue: number;
  taskFee: number;
}

export interface WalletBalance {
  totalBalance: number;
  minimumRequired: number;
  availableForWithdrawal: number;
  isBelowMinimum: boolean;
  isNegative: boolean;
}

export interface FeeCalculation {
  platformFee: number;
  taskFee: number;
  totalFee: number;
  partnerEarning: number;
}

export interface WalletTransaction {
  id: number;
  type: string;
  amount: number;
  description: string;
  payment_method: string | null;
  balance_after: number;
  created_at: string;
  metadata?: any;
}

// ============================================================================
// Get Wallet Settings from Database
// ============================================================================

export async function getWalletSettings(): Promise<WalletSettings> {
  const settings = await query<{ key_name: string; value: string }[]>(
    `SELECT key_name, value FROM settings 
     WHERE key_name IN (
       'partner_minimum_wallet_balance',
       'partner_platform_fee_type',
       'partner_platform_fee_value',
       'partner_task_fee'
     )`
  );

  const settingsMap = settings.reduce((acc, s) => {
    acc[s.key_name] = s.value;
    return acc;
  }, {} as Record<string, string>);

  return {
    minimumBalance: parseFloat(settingsMap['partner_minimum_wallet_balance'] || '200'),
    platformFeeType: (settingsMap['partner_platform_fee_type'] || 'percentage') as 'percentage' | 'fixed',
    platformFeeValue: parseFloat(settingsMap['partner_platform_fee_value'] || '10'),
    taskFee: parseFloat(settingsMap['partner_task_fee'] || '20'),
  };
}

// ============================================================================
// Calculate Fees for a Task
// ============================================================================

export async function calculateTaskFees(taskAmount: number): Promise<FeeCalculation> {
  const settings = await getWalletSettings();

  let platformFee = 0;
  if (settings.platformFeeType === 'percentage') {
    platformFee = (taskAmount * settings.platformFeeValue) / 100;
  } else {
    platformFee = settings.platformFeeValue;
  }

  const taskFee = settings.taskFee;
  const totalFee = platformFee + taskFee;
  const partnerEarning = taskAmount - totalFee;

  return {
    platformFee: Number(platformFee.toFixed(2)),
    taskFee: Number(taskFee.toFixed(2)),
    totalFee: Number(totalFee.toFixed(2)),
    partnerEarning: Number(partnerEarning.toFixed(2)),
  };
}

// ============================================================================
// Get Partner Wallet Balance with Details
// ============================================================================

export async function getPartnerWalletBalance(partnerId: number): Promise<WalletBalance> {
  // Get partner's current balance
  const [partner] = await query<{ balance: number }[]>(
    `SELECT balance FROM partners WHERE id = ? AND deleted_at IS NULL`,
    [partnerId]
  );

  if (!partner) {
    throw new Error('Partner not found');
  }

  const totalBalance = Number(partner.balance ?? 0);
  const settings = await getWalletSettings();
  const minimumRequired = settings.minimumBalance;

  // Calculate available balance for withdrawal
  const availableForWithdrawal = Math.max(0, totalBalance - minimumRequired);

  return {
    totalBalance: Number(totalBalance.toFixed(2)),
    minimumRequired: Number(minimumRequired.toFixed(2)),
    availableForWithdrawal: Number(availableForWithdrawal.toFixed(2)),
    isBelowMinimum: totalBalance < minimumRequired,
    isNegative: totalBalance < 0,
  };
}

// ============================================================================
// Calculate Pending Fees (fees not yet deducted from earnings)
// ============================================================================

export async function calculatePendingFees(partnerId: number): Promise<{
  totalPendingFees: number;
  platformFees: number;
  taskFees: number;
  grossEarnings: number;
  netEarnings: number;
}> {
  // Get all earning transactions with their reference_id (booking_id)
  const transactions = await query<any[]>(
    `SELECT id, reference_id, metadata 
     FROM wallet_transactions
     WHERE partner_id = ? 
     AND type = 'earning'
     AND reference_type = 'booking'
     AND metadata IS NOT NULL`,
    [partnerId]
  );

  console.log(`🔍 [calculatePendingFees] Found ${transactions.length} earning transactions for partner ${partnerId}`);

  // Get all bookings that already have fee deductions
  const deductedBookings = await query<any[]>(
    `SELECT DISTINCT reference_id 
     FROM wallet_transactions
     WHERE partner_id = ? 
     AND type = 'fee_deduction'
     AND reference_type = 'booking'`,
    [partnerId]
  );

  const deductedBookingIds = new Set(deductedBookings.map(d => d.reference_id));
  console.log(`🔍 [calculatePendingFees] Found ${deductedBookingIds.size} bookings with fees already deducted`);

  let platformFees = 0;
  let taskFees = 0;
  let grossEarnings = 0;

  transactions.forEach((t, index) => {
    if (t.metadata) {
      const meta = JSON.parse(t.metadata);
      console.log(`📋 Transaction ${index + 1} (Booking #${t.reference_id}):`, meta);
      
      // Check if fees are pending:
      // 1. New transactions have fees_pending flag set to true
      // 2. Old transactions don't have the flag, so check if fees were already deducted
      const hasFeesPending = meta.fees_pending === true || 
                            (meta.fees_pending === undefined && !deductedBookingIds.has(t.reference_id));
      
      if (hasFeesPending) {
        platformFees += meta.platform_fee || 0;
        taskFees += meta.task_fee || 0;
        grossEarnings += meta.total_amount || 0;
        console.log(`✅ Added to pending: Platform=${meta.platform_fee}, Task=${meta.task_fee}, Total=${meta.total_amount}`);
      } else {
        console.log(`⏭️  Skipped (fees already deducted or fees_pending=false)`);
      }
    }
  });

  const totalPendingFees = platformFees + taskFees;
  const netEarnings = grossEarnings - totalPendingFees;

  console.log(`💰 [calculatePendingFees] Summary:`, {
    grossEarnings,
    platformFees,
    taskFees,
    totalPendingFees,
    netEarnings
  });

  return {
    totalPendingFees: Number(totalPendingFees.toFixed(2)),
    platformFees: Number(platformFees.toFixed(2)),
    taskFees: Number(taskFees.toFixed(2)),
    grossEarnings: Number(grossEarnings.toFixed(2)),
    netEarnings: Number(netEarnings.toFixed(2)),
  };
}

// ============================================================================
// Validate Withdrawal Amount
// ============================================================================

export async function validateWithdrawalAmount(
  partnerId: number,
  requestedAmount: number
): Promise<{
  isValid: boolean;
  error?: string;
  balanceInfo?: WalletBalance;
  pendingFees?: {
    totalPendingFees: number;
    platformFees: number;
    taskFees: number;
    grossEarnings: number;
  };
}> {
  try {
    const balanceInfo = await getPartnerWalletBalance(partnerId);
    const pendingFees = await calculatePendingFees(partnerId);

    // Calculate available balance after deducting pending fees and minimum balance
    const availableForWithdrawal = Math.max(
      0,
      balanceInfo.totalBalance - balanceInfo.minimumRequired - pendingFees.totalPendingFees
    );

    // Check if wallet is negative
    if (balanceInfo.isNegative) {
      return {
        isValid: false,
        error: `Your wallet balance is negative (₹${balanceInfo.totalBalance.toFixed(2)}). Please add money before requesting withdrawal.`,
        balanceInfo,
        pendingFees,
      };
    }

    // Check if requested amount exceeds available balance
    if (requestedAmount > availableForWithdrawal) {
      return {
        isValid: false,
        error: `Insufficient available balance. You have ₹${balanceInfo.totalBalance.toFixed(2)} total, but ₹${pendingFees.totalPendingFees.toFixed(2)} will be deducted as fees and ₹${balanceInfo.minimumRequired.toFixed(2)} must remain as minimum balance. Available for withdrawal: ₹${availableForWithdrawal.toFixed(2)}`,
        balanceInfo,
        pendingFees,
      };
    }

    return {
      isValid: true,
      balanceInfo,
      pendingFees,
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Failed to validate withdrawal amount',
    };
  }
}

// ============================================================================
// Record Wallet Transaction
// ============================================================================

export async function recordWalletTransaction(
  partnerId: number,
  type: 'earning' | 'fee_deduction' | 'withdrawal' | 'topup' | 'refund' | 'penalty',
  amount: number,
  description: string,
  options: {
    referenceType?: string;
    referenceId?: number;
    paymentMethod?: string;
    metadata?: any;
  } = {}
): Promise<void> {
  // Get current balance
  const [partner] = await query<{ balance: number }[]>(
    `SELECT balance FROM partners WHERE id = ?`,
    [partnerId]
  );

  if (!partner) {
    throw new Error('Partner not found');
  }

  // Force numeric coercion — MySQL DECIMAL columns are returned as strings by mysql2,
  // so arithmetic without Number() causes string concatenation (e.g. -160 + "360" = "-160360")
  const balanceBefore = Number(partner.balance ?? 0);
  const amountNum     = Number(amount);

  // Calculate new balance based on transaction type
  let balanceAfter = balanceBefore;
  if (type === 'earning' || type === 'topup' || type === 'refund') {
    balanceAfter = balanceBefore + amountNum;
  } else if (type === 'fee_deduction' || type === 'withdrawal' || type === 'penalty') {
    balanceAfter = balanceBefore - amountNum;
  }

  // Record transaction
  await query(
    `INSERT INTO wallet_transactions 
     (partner_id, type, amount, description, reference_type, reference_id, payment_method, balance_before, balance_after, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      partnerId,
      type,
      amountNum,
      description,
      options.referenceType || null,
      options.referenceId || null,
      options.paymentMethod || null,
      balanceBefore,
      balanceAfter,
      options.metadata ? JSON.stringify(options.metadata) : null,
    ]
  );

  // Update partner balance
  await query(
    `UPDATE partners SET balance = ? WHERE id = ?`,
    [balanceAfter, partnerId]
  );
}

// ============================================================================
// Credit Partner Wallet (for completed bookings)
// ============================================================================

export async function creditPartnerWallet(
  partnerId: number,
  bookingId: number,
  totalAmount: number,
  paymentMethod: 'online' | 'cash'
): Promise<{ success: boolean; newBalance: number; fees: FeeCalculation }> {
  const fees = await calculateTaskFees(totalAmount);

  if (paymentMethod === 'cash') {
    // CASH PAYMENT: Partner already collected money from customer
    // Deduct fees immediately (wallet goes NEGATIVE)
    // Partner owes admin these fees and must pay via Razorpay topup
    await recordWalletTransaction(
      partnerId,
      'fee_deduction',
      fees.totalFee,
      `Cash payment fees for Booking #${bookingId} (Platform: ₹${fees.platformFee}, Task: ₹${fees.taskFee})`,
      {
        referenceType: 'booking',
        referenceId: bookingId,
        paymentMethod: 'cash',
        metadata: {
          total_amount: totalAmount,
          platform_fee: fees.platformFee,
          task_fee: fees.taskFee,
          total_fee: fees.totalFee,
          fees_pending: false, // Already deducted
          payment_type: 'cash_collection',
          partner_earning: fees.partnerEarning,
        },
      }
    );
  } else {
    // ONLINE PAYMENT: Admin received money in Razorpay
    // Credit FULL amount to wallet (fees deducted at withdrawal time)
    await recordWalletTransaction(
      partnerId,
      'earning',
      totalAmount,
      `Booking #${bookingId} completed - Online payment`,
      {
        referenceType: 'booking',
        referenceId: bookingId,
        paymentMethod: 'online',
        metadata: {
          total_amount: totalAmount,
          platform_fee: fees.platformFee,
          task_fee: fees.taskFee,
          total_fee: fees.totalFee,
          fees_pending: true, // Deducted at withdrawal
        },
      }
    );
  }

  const balance = await getPartnerWalletBalance(partnerId);

  return {
    success: true,
    newBalance: balance.totalBalance,
    fees,
  };
}

// ============================================================================
// Get Wallet Transactions History
// ============================================================================

export async function getWalletTransactions(
  partnerId: number,
  limit: number = 50,
  offset: number = 0
): Promise<WalletTransaction[]> {
  const transactions = await query<WalletTransaction[]>(
    `SELECT 
      id,
      type,
      amount,
      description,
      payment_method,
      balance_after,
      created_at,
      metadata
     FROM wallet_transactions
     WHERE partner_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [partnerId, limit, offset]
  );

  return transactions.map(t => ({
    ...t,
    metadata: t.metadata ? JSON.parse(t.metadata as any) : null,
  }));
}

// ============================================================================
// Get Wallet Statistics (for display)
// ============================================================================

export async function getWalletStatistics(
  partnerId: number,
  period: 'month' | 'week' | 'all' = 'month'
): Promise<{
  totalEarnings: number;
  platformFeesDeducted: number;
  taskFeesDeducted: number;
  withdrawals: number;
  topups: number;
  netEarnings: number;
}> {
  let dateFilter = '';
  if (period === 'month') {
    dateFilter = `AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)`;
  } else if (period === 'week') {
    dateFilter = `AND created_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)`;
  }

  const [stats] = await query<any[]>(
    `SELECT 
      COALESCE(SUM(CASE WHEN type = 'earning' THEN amount ELSE 0 END), 0) as total_earnings,
      COALESCE(SUM(CASE WHEN type = 'fee_deduction' THEN amount ELSE 0 END), 0) as fees_deducted,
      COALESCE(SUM(CASE WHEN type = 'withdrawal' THEN amount ELSE 0 END), 0) as withdrawals,
      COALESCE(SUM(CASE WHEN type = 'topup' THEN amount ELSE 0 END), 0) as topups
     FROM wallet_transactions
     WHERE partner_id = ? ${dateFilter}`,
    [partnerId]
  );

  // Get fee breakdown from metadata
  const feeTransactions = await query<any[]>(
    `SELECT metadata 
     FROM wallet_transactions
     WHERE partner_id = ? AND type = 'fee_deduction' ${dateFilter}`,
    [partnerId]
  );

  let platformFeesDeducted = 0;
  let taskFeesDeducted = 0;

  feeTransactions.forEach(t => {
    if (t.metadata) {
      const meta = JSON.parse(t.metadata);
      platformFeesDeducted += meta.platform_fee || 0;
      taskFeesDeducted += meta.task_fee || 0;
    }
  });

  const totalEarnings = Number(stats.total_earnings || 0);
  const feesDeducted = Number(stats.fees_deducted || 0);
  const withdrawals = Number(stats.withdrawals || 0);
  const topups = Number(stats.topups || 0);
  const netEarnings = totalEarnings - feesDeducted - withdrawals + topups;

  return {
    totalEarnings: Number(totalEarnings.toFixed(2)),
    platformFeesDeducted: Number(platformFeesDeducted.toFixed(2)),
    taskFeesDeducted: Number(taskFeesDeducted.toFixed(2)),
    withdrawals: Number(withdrawals.toFixed(2)),
    topups: Number(topups.toFixed(2)),
    netEarnings: Number(netEarnings.toFixed(2)),
  };
}

// ============================================================================
// Deduct Pending Fees (called at withdrawal time)
// ============================================================================

export async function deductPendingFees(partnerId: number): Promise<{
  success: boolean;
  feesDeducted: number;
  platformFees: number;
  taskFees: number;
}> {
  const pendingFees = await calculatePendingFees(partnerId);

  if (pendingFees.totalPendingFees <= 0) {
    return {
      success: true,
      feesDeducted: 0,
      platformFees: 0,
      taskFees: 0,
    };
  }

  // Record fee deduction transaction
  await recordWalletTransaction(
    partnerId,
    'fee_deduction',
    pendingFees.totalPendingFees,
    `Platform and task fees deducted at withdrawal`,
    {
      referenceType: 'withdrawal',
      referenceId: undefined,
      paymentMethod: undefined,
      metadata: {
        platform_fee: pendingFees.platformFees,
        task_fee: pendingFees.taskFees,
        total_fee: pendingFees.totalPendingFees,
        gross_earnings: pendingFees.grossEarnings,
      },
    }
  );

  // Mark all pending fees as deducted by updating metadata
  await query(
    `UPDATE wallet_transactions 
     SET metadata = JSON_SET(metadata, '$.fees_pending', false)
     WHERE partner_id = ? 
     AND type = 'earning'
     AND JSON_EXTRACT(metadata, '$.fees_pending') = true`,
    [partnerId]
  );

  return {
    success: true,
    feesDeducted: pendingFees.totalPendingFees,
    platformFees: pendingFees.platformFees,
    taskFees: pendingFees.taskFees,
  };
}
