import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';
import { notifyAdmins, notifyPartner } from '@/lib/notificationHelper';

/**
 * POST /api/customer/bookings/[id]/cancel
 * Customer cancels a booking.
 * Allowed states: 'finding' or 'matched' (not once in_progress or later).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'customer');
    if (authError) return authError;

    const { id } = await params;
    const bookingId = parseInt(id, 10);
    if (isNaN(bookingId) || bookingId <= 0) {
      return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const reason: string = body.reason?.toString().trim() || 'Cancelled by customer';

    // Fetch booking — must belong to this customer
    const rows = await query<Array<{
      id: number;
      status: string;
      partner_id: number | null;
      service_name: string;
      total_price: string;
      customer_name: string | null;
      customer_phone: string;
    }>>(
      `SELECT b.id, b.status, b.partner_id,
              COALESCE(cat.name, s.name) AS service_name,
              b.total_price,
              c.name AS customer_name,
              c.phone AS customer_phone
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       LEFT JOIN categories cat ON cat.id = s.category_id AND cat.deleted_at IS NULL
       JOIN customers c ON c.id = b.customer_id
       WHERE b.id = ? AND b.customer_id = ? AND b.deleted_at IS NULL
       LIMIT 1`,
      [bookingId, payload.userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const booking = rows[0];
    const cancellableStatuses = ['finding', 'matched'];

    if (!cancellableStatuses.includes(booking.status)) {
      return NextResponse.json(
        { error: `Booking cannot be cancelled in '${booking.status}' state` },
        { status: 409 }
      );
    }

    // Cancel the booking
    await query(
      `UPDATE bookings SET status = 'cancelled', updated_at = NOW() WHERE id = ?`,
      [bookingId]
    );

    const customerName = booking.customer_name || booking.customer_phone;
    const totalPrice = parseFloat(booking.total_price);

    // Notify partner if one was already assigned
    if (booking.partner_id) {
      await notifyPartner(
        booking.partner_id,
        'Booking Cancelled',
        `Booking #${bookingId} for ${booking.service_name} has been cancelled by the customer`,
        {
          type: 'booking_cancelled',
          booking_id: bookingId.toString(),
          service_name: booking.service_name,
          reason,
        },
        'partner-notifications'
      );
    }

    // Notify admins
    await notifyAdmins(
      'notify_booking_cancelled',
      'Booking Cancelled',
      `Booking #${bookingId} cancelled by ${customerName} — ${booking.service_name} (₹${totalPrice})`,
      {
        type: 'booking_cancelled',
        booking_id: bookingId.toString(),
        customer_id: payload.userId.toString(),
        service_name: booking.service_name,
        total_price: totalPrice.toString(),
        reason,
        cancelled_by: 'customer',
      },
      'system'
    );

    return NextResponse.json({
      success: true,
      booking_id: bookingId,
      status: 'cancelled',
      message: 'Booking cancelled successfully',
    });
  } catch (err) {
    console.error('[customer/bookings/cancel] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
