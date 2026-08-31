import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';
import { notifyAdmins } from '@/lib/notificationHelper';

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

    // Minimum withdrawal amount (e.g., ₹100)
    const MIN_WITHDRAWAL = 100;
    if (amount < MIN_WITHDRAWAL) {
      return NextResponse.json({ 
        error: `Minimum withdrawal amount is ₹${MIN_WITHDRAWAL}` 
      }, { status: 400 });
    }

    // Get partner's current balance
    const [partner] = await query<{ balance: number; name: string; phone: string }[]>(
      `SELECT balance, name, phone FROM partners WHERE id = ? AND deleted_at IS NULL`,
      [payload.userId]
    );

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const currentBalance = Number(partner.balance || 0);

    // Check if partner has sufficient balance
    if (amount > currentBalance) {
      return NextResponse.json({ 
        error: `Insufficient balance. Available: ₹${currentBalance.toFixed(2)}` 
      }, { status: 400 });
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

    // Create withdrawal request
    const result = await query<{ insertId: number }>(
      `INSERT INTO withdrawal_requests (partner_id, amount, partner_notes, status)
       VALUES (?, ?, ?, 'pending')`,
      [payload.userId, amount, partnerNotes]
    );

    // Send push notification to admins about withdrawal request
    console.log(`[NOTIFY] Withdrawal request: ID ${result.insertId}, Partner: ${partner.name} (${partner.phone}), Amount: ₹${amount}`);
    await notifyAdmins(
      'notify_withdrawal',
      'Withdrawal Request',
      `${partner.name} requested withdrawal of ₹${amount}`,
      { 
        type: 'withdrawal_request', 
        request_id: result.insertId.toString(), 
        partner_id: payload.userId.toString(),
        partner_name: partner.name,
        partner_phone: partner.phone,
        amount: amount.toString(),
        notes: partnerNotes || 'None'
      },
      'partner-notifications'
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Withdrawal request submitted successfully',
      request_id: result.insertId,
      amount: amount,
      status: 'pending'
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
