import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';

// POST /api/partner/location
// Body: { lat: number, lng: number }
// Called by the partner app when they go online and periodically while online.
// Stores the partner's current GPS coordinates, marks them online, and
// updates last_seen_at so the system knows they are active.
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

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: 'Invalid coordinate values' }, { status: 400 });
    }

    // Update location + mark partner as online.
    // is_online uses IF(column_exists) pattern via a safe CASE — if the column
    // doesn't exist yet the migration will add it; until then only lat/lng/last_seen_at
    // are updated (the query falls back gracefully via the try/catch below).
    try {
      await query(
        `UPDATE partners
         SET lat          = ?,
             lng          = ?,
             is_online    = 1,
             last_seen_at = NOW(),
             updated_at   = NOW()
         WHERE id = ?`,
        [lat, lng, payload.userId]
      );
    } catch (colErr: unknown) {
      // is_online column doesn't exist yet — fall back to updating only coords
      const msg = colErr instanceof Error ? colErr.message : String(colErr);
      if (msg.includes('is_online')) {
        await query(
          `UPDATE partners
           SET lat          = ?,
               lng          = ?,
               last_seen_at = NOW(),
               updated_at   = NOW()
           WHERE id = ?`,
          [lat, lng, payload.userId]
        );
      } else {
        throw colErr;
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('partner/location error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/partner/location  (or called on logout)
// Marks the partner as offline without clearing their last known coordinates.
export async function DELETE(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'partner');
    if (authError) return authError;

    try {
      await query(
        `UPDATE partners SET is_online = 0, updated_at = NOW() WHERE id = ?`,
        [payload.userId]
      );
    } catch (colErr: unknown) {
      const msg = colErr instanceof Error ? colErr.message : String(colErr);
      if (!msg.includes('is_online')) throw colErr;
      // Column not yet migrated — nothing to do
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('partner/location DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
