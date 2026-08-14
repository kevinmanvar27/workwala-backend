import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';

// GET /api/customer/bookings/[id]/status
// Returns the current status of a booking, plus partner info when matched.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload || payload.roleSlug !== 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const bookingId = parseInt(id, 10);
    if (isNaN(bookingId)) {
      return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
    }

    const rows = await query<Array<{
      id: number;
      status: string;
      partner_id: number | null;
      partner_name: string | null;
      partner_phone: string | null;
      otp_code: string | null;
    }>>(
      `SELECT b.id, b.status, b.partner_id, b.otp_code,
              COALESCE(p.name, p.phone) AS partner_name,
              p.phone AS partner_phone
       FROM bookings b
       LEFT JOIN partners p ON p.id = b.partner_id
       WHERE b.id = ? AND b.customer_id = ?
       LIMIT 1`,
      [bookingId, payload.userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const b = rows[0];
    return NextResponse.json({
      success: true,
      id: b.id,
      status: b.status,
      partner_id: b.partner_id ?? null,
      partner_name: b.partner_name ?? null,
      partner_phone: b.partner_phone ?? null,
      // Only expose OTP when a partner has been matched
      otp_code: b.status === 'matched' || b.status === 'in_progress' ? (b.otp_code ?? null) : null,
    });
  } catch (err) {
    console.error('booking status GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
