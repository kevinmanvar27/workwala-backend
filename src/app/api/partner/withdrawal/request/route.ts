import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';
import { notifyAdmins } from '@/lib/notificationHelper';
import { validateWithdrawalAmount, deductPendingFees, calculatePendingFees, getWalletSettings } from '@/lib/walletHelper';

// POST /api/partner/withdrawal/request
// Partner submits a withdrawal request
export async function POST(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'partner');
    if (authError) return authError;

    const body = await req.json();
    const amount = parseFloat(body.amount);
    const partnerNotes = body.notes?.toString().trim() || null;

    // Validate amount
    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Valid withdrawal amount is required' }, { status: 400 });
    }

    // Get wallet settings for minimum withdrawal amount
    const walletSettings = await getWalletSettings();
    const MIN_WITHDRAWAL = walletSettings.minimumWithdrawalAmount;
    
    if (amount < MIN_WITHDRAWAL) {
      return NextResponse.json({ 
        error: `Minimum withdrawal amount is ₹${MIN_WITHDRAWAL}` 
      }, { status: 400 });
    }

    // Validate withdrawal amount against available balance (considering minimum balance requirement)
    const validation = await validateWithdrawalAmount(payload.userId, amount);
    
    if (!validation.isValid) {
      return NextResponse.json({ 
        error: validation.error,
        balance_info: validation.balanceInfo
      }, { status: 400 });
    }

    // Get partner details for notification
    const [partner] = await query<{ name: string; phone: string }[]>(
      `SELECT name, phone FROM partners WHERE id = ? AND deleted_at IS NULL`,
      [payload.userId]
    );

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Check for pending withdrawal requests
    const [pendingRequest] = await query<{ id: number; amount: number }[]>(
      `SELECT id, amount FROM withdrawal_requests 
       WHERE partner_id = ? AND status = 'pending' AND deleted_at IS NULL
       LIMIT 1`,
      [payload.userId]
    );

    if (pendingRequest) {
      return NextResponse.json({ 
        error: `You already have a pending withdrawal request of ₹${pendingRequest.amount}. Please wait for it to be processed.` 
      }, { status: 400 });
    }

    // Calculate pending fees BEFORE deduction (for storing in withdrawal_requests)
    const pendingFeesInfo = await calculatePendingFees(payload.userId);
    console.log(`[WALLET] Pending fees before deduction:`, pendingFeesInfo);

    // Deduct pending fees before creating withdrawal request
    const feeDeduction = await deductPendingFees(payload.userId);
    console.log(`[WALLET] Fees deducted at withdrawal: ₹${feeDeduction.feesDeducted} (Platform: ₹${feeDeduction.platformFees}, Task: ₹${feeDeduction.taskFees})`);

    // Calculate net payout (withdrawal amount is already after fees)
    const grossAmount = pendingFeesInfo.grossEarnings;
    const platformFee = feeDeduction.platformFees;
    const taskFee = feeDeduction.taskFees;
    const totalFee = feeDeduction.feesDeducted;
    const netPayout = amount; // The amount partner requested is the net amount after fees

    // Create withdrawal request with fee breakdown
    const result = await query<{ insertId: number }>(
      `INSERT INTO withdrawal_requests 
       (partner_id, amount, gross_amount, platform_fee, task_fee, total_fee, net_payout, partner_notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [payload.userId, amount, grossAmount, platformFee, taskFee, totalFee, netPayout, partnerNotes]
    );

    // Send push notification to admins about withdrawal request
    console.log(`[NOTIFY] Withdrawal request: ID ${result.insertId}, Partner: ${partner.name} (${partner.phone}), Amount: ₹${amount}, Fees: ₹${totalFee}`);
    await notifyAdmins(
      'notify_withdrawal',
      'Withdrawal Request',
      `${partner.name} requested withdrawal of ₹${amount} (Fees: ₹${totalFee.toFixed(2)})`,
      { 
        type: 'withdrawal_request', 
        request_id: result.insertId.toString(), 
        partner_id: payload.userId.toString(),
        partner_name: partner.name,
        partner_phone: partner.phone,
        amount: amount.toString(),
        gross_amount: grossAmount.toString(),
        platform_fee: platformFee.toString(),
        task_fee: taskFee.toString(),
        total_fee: totalFee.toString(),
        net_payout: netPayout.toString(),
        notes: partnerNotes || 'None'
      },
      'partner-notifications'
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Withdrawal request submitted successfully',
      request_id: result.insertId,
      amount: amount,
      status: 'pending',
      balance_info: validation.balanceInfo
    }, { status: 201 });

  } catch (err) {
    console.error('Withdrawal request error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/partner/withdrawal/request
// Get partner's withdrawal request history
export async function GET(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'partner');
    if (authError) return authError;

    const requests = await query<{
      id: number;
      amount: number;
      status: string;
      request_date: string;
      processed_date: string | null;
      admin_notes: string | null;
      partner_notes: string | null;
      transaction_id: string | null;
    }[]>(
      `SELECT id, amount, status, request_date, processed_date, 
              admin_notes, partner_notes, transaction_id
       FROM withdrawal_requests
       WHERE partner_id = ? AND deleted_at IS NULL
       ORDER BY request_date DESC
       LIMIT 50`,
      [payload.userId]
    );

    return NextResponse.json({ 
      success: true, 
      requests 
    });

  } catch (err) {
    console.error('Get withdrawal requests error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
