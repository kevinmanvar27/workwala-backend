import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { logActivity, getClientIp } from '@/lib/activityLogger';

// GET /api/admin/withdrawals — list withdrawal requests with filters
export async function GET(req: NextRequest) {
  console.log('🔍 Admin withdrawals API called');
  const { error } = await requirePermission(req, 'users.view');
  if (error) {
    console.log('❌ Permission denied');
    return error;
  }
  console.log('✅ Permission granted');

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';
    const page   = parseInt(searchParams.get('page')  || '1');
    const limit  = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const searchWild = `%${search}%`;

    const statusFilter = status !== 'all' ? `AND wr.status = ?` : '';
    const params: (string | number)[] = [searchWild, searchWild];
    if (status !== 'all') params.push(status);
    params.push(limit, offset);

    const withdrawals = await query<{
      id: number;
      partner_id: number;
      partner_name: string;
      partner_phone: string;
      amount: number;
      status: string;
      request_date: string;
      processed_date: string | null;
      processed_by: number | null;
      admin_name: string | null;
      admin_notes: string | null;
      partner_notes: string | null;
      transaction_id: string | null;
      partner_balance: number;
    }[]>(
      `SELECT wr.id, wr.partner_id, wr.amount, wr.status, 
              wr.request_date, wr.processed_date, wr.processed_by,
              wr.admin_notes, wr.partner_notes, wr.transaction_id,
              p.name AS partner_name, p.phone AS partner_phone, p.balance AS partner_balance,
              u.name AS admin_name
       FROM withdrawal_requests wr
       INNER JOIN partners p ON p.id = wr.partner_id
       LEFT JOIN users u ON u.id = wr.processed_by
       WHERE wr.deleted_at IS NULL
         AND (p.name LIKE ? OR p.phone LIKE ?)
         ${statusFilter}
       ORDER BY 
         CASE wr.status 
           WHEN 'pending' THEN 1 
           WHEN 'approved' THEN 2 
           WHEN 'completed' THEN 3 
           WHEN 'rejected' THEN 4 
         END,
         wr.request_date DESC
       LIMIT ? OFFSET ?`,
      params
    );
    
    console.log('📊 Query returned', withdrawals.length, 'withdrawals');
    
    // Ensure numeric fields are properly converted
    const normalizedWithdrawals = withdrawals.map(w => ({
      ...w,
      amount: Number(w.amount),
      partner_balance: Number(w.partner_balance),
    }));

    const countParams: (string | number)[] = [searchWild, searchWild];
    if (status !== 'all') countParams.push(status);

    const [total] = await query<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM withdrawal_requests wr
       INNER JOIN partners p ON p.id = wr.partner_id
       WHERE wr.deleted_at IS NULL
         AND (p.name LIKE ? OR p.phone LIKE ?)
         ${statusFilter}`,
      countParams
    );

    // Get summary statistics
    const [stats] = await query<{
      pending_count: number;
      pending_amount: number;
      approved_count: number;
      approved_amount: number;
      completed_count: number;
      completed_amount: number;
    }[]>(
      `SELECT 
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
         SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS pending_amount,
         SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
         SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) AS approved_amount,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
         SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) AS completed_amount
       FROM withdrawal_requests
       WHERE deleted_at IS NULL`
    );

    return NextResponse.json({ 
      withdrawals: normalizedWithdrawals, 
      total: total.count, 
      page, 
      limit,
      stats: {
        pending: {
          count: Number(stats?.pending_count || 0),
          amount: Number(stats?.pending_amount || 0)
        },
        approved: {
          count: Number(stats?.approved_count || 0),
          amount: Number(stats?.approved_amount || 0)
        },
        completed: {
          count: Number(stats?.completed_count || 0),
          amount: Number(stats?.completed_amount || 0)
        }
      }
    });
  } catch (err) {
    console.error('❌ Error in withdrawals API:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/admin/withdrawals — update withdrawal request status
export async function PATCH(req: NextRequest) {
  const { error, user: actor } = await requirePermission(req, 'users.view');
  if (error) return error;

  try {
    const body = await req.json() as {
      id: number;
      action: 'approve' | 'reject' | 'complete';
      admin_notes?: string;
      transaction_id?: string;
    };

    const { id, action, admin_notes, transaction_id } = body;

    if (!id || !action) {
      return NextResponse.json({ error: 'id and action are required' }, { status: 400 });
    }

    // Get withdrawal request details
    const [withdrawal] = await query<{
      id: number;
      partner_id: number;
      amount: number;
      status: string;
      partner_name: string;
      partner_phone: string;
      partner_balance: number;
    }[]>(
      `SELECT wr.id, wr.partner_id, wr.amount, wr.status,
              p.name AS partner_name, p.phone AS partner_phone, p.balance AS partner_balance
       FROM withdrawal_requests wr
       INNER JOIN partners p ON p.id = wr.partner_id
       WHERE wr.id = ? AND wr.deleted_at IS NULL`,
      [id]
    );

    if (!withdrawal) {
      return NextResponse.json({ error: 'Withdrawal request not found' }, { status: 404 });
    }

    let newStatus: string;
    let shouldDeductBalance = false;

    switch (action) {
      case 'approve':
        if (withdrawal.status !== 'pending') {
          return NextResponse.json({ 
            error: 'Only pending requests can be approved' 
          }, { status: 400 });
        }
        newStatus = 'approved';
        break;

      case 'reject':
        if (withdrawal.status !== 'pending') {
          return NextResponse.json({ 
            error: 'Only pending requests can be rejected' 
          }, { status: 400 });
        }
        newStatus = 'rejected';
        break;

      case 'complete':
        if (withdrawal.status !== 'approved' && withdrawal.status !== 'pending') {
          return NextResponse.json({ 
            error: 'Only approved or pending requests can be completed' 
          }, { status: 400 });
        }
        if (!transaction_id || transaction_id.trim() === '') {
          return NextResponse.json({ 
            error: 'Transaction ID is required to complete withdrawal' 
          }, { status: 400 });
        }
        newStatus = 'completed';
        shouldDeductBalance = true;
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Check if partner has sufficient balance (for complete action)
    if (shouldDeductBalance) {
      if (withdrawal.amount > withdrawal.partner_balance) {
        return NextResponse.json({ 
          error: `Partner has insufficient balance. Available: ₹${withdrawal.partner_balance.toFixed(2)}` 
        }, { status: 400 });
      }
    }

    // Update withdrawal request
    await query(
      `UPDATE withdrawal_requests 
       SET status = ?, 
           processed_date = NOW(), 
           processed_by = ?,
           admin_notes = ?,
           transaction_id = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [newStatus, actor!.userId, admin_notes || null, transaction_id || null, id]
    );

    // Deduct balance from partner if completing withdrawal
    if (shouldDeductBalance) {
      await query(
        `UPDATE partners 
         SET balance = balance - ?,
             updated_at = NOW()
         WHERE id = ?`,
        [withdrawal.amount, withdrawal.partner_id]
      );
    }

    // Log activity
    await logActivity({
      userId: actor!.userId,
      userName: actor!.email,
      action: action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : 'Completed',
      module: 'withdrawals',
      targetId: id,
      targetName: `${withdrawal.partner_name || withdrawal.partner_phone} - ₹${withdrawal.amount}`,
      description: admin_notes || `Withdrawal request ${action}ed`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ 
      success: true, 
      status: newStatus,
      message: `Withdrawal request ${action}ed successfully`
    });

  } catch (err) {
    console.error('Withdrawals PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/withdrawals — soft delete withdrawal request
export async function DELETE(req: NextRequest) {
  const { error, user: actor } = await requirePermission(req, 'users.view');
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get('id') || '0');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const [withdrawal] = await query<{
      id: number;
      partner_name: string;
      partner_phone: string;
      amount: number;
      status: string;
    }[]>(
      `SELECT wr.id, p.name AS partner_name, p.phone AS partner_phone, wr.amount, wr.status
       FROM withdrawal_requests wr
       INNER JOIN partners p ON p.id = wr.partner_id
       WHERE wr.id = ? AND wr.deleted_at IS NULL`,
      [id]
    );

    if (!withdrawal) {
      return NextResponse.json({ error: 'Withdrawal request not found' }, { status: 404 });
    }

    // Only allow deletion of rejected requests
    if (withdrawal.status !== 'rejected') {
      return NextResponse.json({ 
        error: 'Only rejected withdrawal requests can be deleted' 
      }, { status: 400 });
    }

    await query(
      `UPDATE withdrawal_requests SET deleted_at = NOW() WHERE id = ?`,
      [id]
    );

    await logActivity({
      userId: actor!.userId,
      userName: actor!.email,
      action: 'Deleted',
      module: 'withdrawals',
      targetId: id,
      targetName: `${withdrawal.partner_name || withdrawal.partner_phone} - ₹${withdrawal.amount}`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error('Withdrawals DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
