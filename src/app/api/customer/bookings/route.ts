import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';

// POST /api/customer/bookings — create a new booking
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload || payload.roleSlug !== 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { service_id, duration_minutes, address } = await req.json();

    if (!service_id || !duration_minutes || !address) {
      return NextResponse.json(
        { error: 'service_id, duration_minutes, and address are required' },
        { status: 400 }
      );
    }
    if (duration_minutes < 30 || duration_minutes % 30 !== 0) {
      return NextResponse.json(
        { error: 'duration_minutes must be a multiple of 30 and at least 30' },
        { status: 400 }
      );
    }

    // Fetch service + linked category to get the correct live price
    const services = await query<{
      id: number;
      name: string;
      svc_price: string;
      cat_name: string | null;
      cat_price: string | null;
    }[]>(
      `SELECT s.id,
              COALESCE(c.name, s.name)                      AS name,
              s.price_per_hour                               AS svc_price,
              c.price_per_hour                               AS cat_price
       FROM services s
       LEFT JOIN categories c ON c.id = s.category_id
                              AND c.deleted_at IS NULL
                              AND c.is_active = 1
       WHERE s.id = ?
         AND s.is_active = 1
         AND s.deleted_at IS NULL
         AND (s.category_id IS NULL OR c.id IS NOT NULL)
       LIMIT 1`,
      [service_id]
    );
    if (services.length === 0) {
      return NextResponse.json({ error: 'Service not found or inactive' }, { status: 404 });
    }

    const service = services[0];
    const pricePerHour = parseFloat(service.cat_price ?? service.svc_price);
    // Price is proportional: e.g. 30 min = 0.5 × hourly rate
    const totalPrice = parseFloat(((pricePerHour * duration_minutes) / 60).toFixed(2));
    // Keep hours column as a decimal for legacy compatibility
    const hours = duration_minutes / 60;

    // Parse lat/lng from address if it's in "lat,lng" format (customer app sends GPS coords)
    let bookingLat: number | null = null;
    let bookingLng: number | null = null;
    const coordParts = address.split(',');
    if (coordParts.length === 2) {
      const parsedLat = parseFloat(coordParts[0].trim());
      const parsedLng = parseFloat(coordParts[1].trim());
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        bookingLat = parsedLat;
        bookingLng = parsedLng;
      }
    }

    const result = await query<{ insertId: number }>(
      `INSERT INTO bookings
         (customer_id, service_id, hours, duration_minutes, price_per_hour, total_price, address, lat, lng, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'finding')`,
      [payload.userId, service_id, hours, duration_minutes, pricePerHour, totalPrice, address, bookingLat, bookingLng]
    );

    return NextResponse.json({
      success: true,
      booking_id: result.insertId,
      service_name: service.name,
      duration_minutes,
      price_per_hour: pricePerHour,
      total_price: totalPrice,
      address,
      status: 'finding',
    });
  } catch (err) {
    console.error('customer bookings POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/customer/bookings?id=:bookingId — poll booking status
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload || payload.roleSlug !== 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const bookingId = searchParams.get('id');
    if (!bookingId) {
      return NextResponse.json({ error: 'Booking id required' }, { status: 400 });
    }

    const bookings = await query<{
      id: number;
      status: string;
      service_name: string;
      duration_minutes: number;
      price_per_hour: string;
      total_price: string;
      address: string;
      partner_id: number | null;
      partner_name: string | null;
      partner_phone: string | null;
    }[]>(
      `SELECT b.id, b.status, s.name AS service_name, b.duration_minutes,
              b.price_per_hour, b.total_price, b.address,
              b.partner_id, p.name AS partner_name, p.phone AS partner_phone
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       LEFT JOIN partners p ON p.id = b.partner_id
       WHERE b.id = ? AND b.customer_id = ?
       LIMIT 1`,
      [bookingId, payload.userId]
    );

    if (bookings.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const b = bookings[0];
    return NextResponse.json({
      success: true,
      id: b.id,
      status: b.status,
      service_name: b.service_name,
      duration_minutes: b.duration_minutes,
      price_per_hour: parseFloat(b.price_per_hour),
      total_price: parseFloat(b.total_price),
      address: b.address,
      partner_id: b.partner_id,
      partner_name: b.partner_name ?? null,
      partner_phone: b.partner_phone ?? null,
    });
  } catch (err) {
    console.error('customer bookings GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
