import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';
import { notifyAdmins, notifyCustomer } from '@/lib/notificationHelper';

/**
 * POST /api/partner/jobs/[id]/cancel
 * Partner cancels an accepted booking.
 * Allowed states: 'matched' only (not finding — partner hasn't accepted yet, not in_progress — work already started).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'partner');
    if (authError) return authError;

    const { id } = await params;
    const jobId = parseInt(id, 10);
    if (isNaN(jobId) || jobId <= 0) {
      return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const reason: string = body.reason?.toString().trim() || 'Cancelled by partner';

    // Fetch booking — must belong to this partner
    const rows = await query<Array<{
      id: number;
      status: string;
      customer_id: number;
      service_name: string;
      total_price: string;
      partner_name: string | null;
      partner_phone: string;
    }>>(
      `SELECT b.id, b.status, b.customer_id,
              COALESCE(cat.name, s.name) AS service_name,
              b.total_price,
              p.name AS partner_name,
              p.phone AS partner_phone
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       LEFT JOIN categories cat ON cat.id = s.category_id AND cat.deleted_at IS NULL
       JOIN partners p ON p.id = b.partner_id
       WHERE b.id = ? AND b.partner_id = ? AND b.deleted_at IS NULL
       LIMIT 1`,
      [jobId, payload.userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const booking = rows[0];

    // Partner can only cancel a matched job (before work starts)
    if (booking.status !== 'matched') {
      return NextResponse.json(
        { error: `Job cannot be cancelled in '${booking.status}' state` },
        { status: 409 }
      );
    }

    // Cancel the booking and clear partner assignment so it can be re-assigned
    await query(
      `UPDATE bookings
       SET status = 'cancelled',
           partner_id = NULL,
           otp_code = NULL,
           otp_plaintext = NULL,
           updated_at = NOW()
       WHERE id = ?`,
      [jobId]
    );

    const partnerName = booking.partner_name || booking.partner_phone;
    const totalPrice = parseFloat(booking.total_price);

    // Notify customer that their booking was cancelled
    await notifyCustomer(
      booking.customer_id,
      'Booking Cancelled',
      `Your booking #${jobId} for ${booking.service_name} has been cancelled by the partner. Please book again.`,
      {
        type: 'booking_cancelled',
        booking_id: jobId.toString(),
        service_name: booking.service_name,
        reason,
      },
      'user-notifications'
    );

    // Notify admins
    await notifyAdmins(
      'notify_booking_cancelled',
      'Booking Cancelled by Partner',
      `Booking #${jobId} cancelled by partner ${partnerName} — ${booking.service_name} (₹${totalPrice})`,
      {
        type: 'booking_cancelled',
        booking_id: jobId.toString(),
        partner_id: payload.userId.toString(),
        service_name: booking.service_name,
        total_price: totalPrice.toString(),
        reason,
        cancelled_by: 'partner',
      },
      'system'
    );

    return NextResponse.json({
      success: true,
      job_id: jobId,
      status: 'cancelled',
      message: 'Job cancelled successfully',
    });
  } catch (err) {
    console.error('[partner/jobs/cancel] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
