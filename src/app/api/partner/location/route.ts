import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';

// POST /api/partner/location
// Body: { lat: number, lng: number }
// Called by the partner app when they go online, and periodically while online.
// Stores the partner's current GPS coordinates + last_seen_at timestamp.
export async function POST(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'partner');
    if (authError) return authError;

    const body = await req.json();
    const lat = typeof body.lat === 'number' ? body.lat : parseFloat(body.lat);
    const lng = typeof body.lng === 'number' ? body.lng : parseFloat(body.lng);

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: 'lat and lng are required numbers' }, { status: 400 });
    }

    // Validate coordinate ranges
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: 'Invalid coordinate values' }, { status: 400 });
    }

    await query(
      `UPDATE partners
       SET lat = ?, lng = ?, last_seen_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [lat, lng, payload.userId]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('partner/location error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
