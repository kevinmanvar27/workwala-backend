import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyPartnerAuth } from '@/lib/auth';
import { notifyCustomer, notifyPartner } from '@/lib/notificationHelper';

// Transitions job status: in_progress → payment_pending
// Called by Partner when they mark the job as completed.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partnerId = await verifyPartnerAuth(req);
    if (!partnerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const jobId = parseInt(id, 10);
    if (isNaN(jobId)) {
      return NextResponse.json({ error: 'Invalid Job ID' }, { status: 400 });
    }

    // Fetch booking
    const rows = await query<Array<{
      id: number;
      partner_id: number | null;
      status: string;
    }>>(
      `SELECT id, partner_id, status FROM bookings WHERE id = ?`,
      [jobId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const booking = rows[0];

    // Verify it belongs to this partner
    if (booking.partner_id !== partnerId) {
      return NextResponse.json({ error: 'Not your job' }, { status: 403 });
    }

    // Must be in_progress
    if (booking.status !== 'in_progress') {
      return NextResponse.json(
        { error: `Job is in '${booking.status}' state, expected 'in_progress'` },
        { status: 400 }
      );
    }

    // Mark as payment_pending
    await query(
      `UPDATE bookings
       SET status = 'payment_pending',
           completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [jobId]
    );

    // Fetch customer_id to send notification
    const customerRows = await query<Array<{ customer_id: number }>>(
      `SELECT customer_id FROM bookings WHERE id = ?`,
      [jobId]
    );

    if (customerRows.length > 0) {
      const customerId = customerRows[0].customer_id;
      console.log(`[NOTIFY] Job marked complete: ID ${jobId}, Customer: ${customerId}`);
      
      // Notify customer that work is complete and payment is pending
      await notifyCustomer(
        customerId,
        'Service Completed',
        'Your service has been completed. Please proceed with payment.',
        { type: 'job_complete', booking_id: jobId.toString() },
        'user-notifications'
      );
    }

    // Notify partner that they successfully marked the job as complete
    await notifyPartner(
      partnerId,
      'Job Marked Complete',
      `Booking #${jobId} marked as complete. Awaiting customer payment.`,
      { type: 'job_complete', booking_id: jobId.toString() },
      'partner-notifications'
    );

    return NextResponse.json({
      success: true,
      message: 'Job marked as complete, awaiting payment',
      status: 'payment_pending',
    });

  } catch (err) {
    console.error('partner job complete error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
