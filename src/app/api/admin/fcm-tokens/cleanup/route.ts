import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';

// GET /api/admin/fcm-tokens/cleanup - Remove invalid/expired FCM tokens
export async function DELETE(req: NextRequest) {
  const { error } = await requirePermission(req, 'settings.edit');
  if (error) return error;

  try {
    // Delete tokens older than 60 days (likely expired)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 60);

    // Clean up admin tokens
    const adminResult = await query<{ affectedRows: number }>(
      `DELETE FROM user_fcm_tokens WHERE created_at < ?`,
      [cutoffDate.toISOString().slice(0, 19).replace('T', ' ')]
    );

    // Clean up customer tokens
    const customerResult = await query<{ affectedRows: number }>(
      `DELETE FROM customer_fcm_tokens WHERE created_at < ?`,
      [cutoffDate.toISOString().slice(0, 19).replace('T', ' ')]
    );

    // Clean up partner tokens
    const partnerResult = await query<{ affectedRows: number }>(
      `DELETE FROM partner_fcm_tokens WHERE created_at < ?`,
      [cutoffDate.toISOString().slice(0, 19).replace('T', ' ')]
    );

    const totalDeleted = 
      (adminResult.affectedRows || 0) + 
      (customerResult.affectedRows || 0) + 
      (partnerResult.affectedRows || 0);

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${totalDeleted} expired FCM tokens`,
      details: {
        admin_tokens: adminResult.affectedRows || 0,
        customer_tokens: customerResult.affectedRows || 0,
        partner_tokens: partnerResult.affectedRows || 0,
      }
    });

  } catch (err) {
    console.error('FCM token cleanup error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
