import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';

// ── INTERFACES ────────────────────────────────────────────────────────────────
interface ServiceArea {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  status: 'active' | 'disabled';
  city: string | null;
  created_at: string;
  updated_at: string;
}

// ── PATCH /api/admin/service-areas/[id] ───────────────────────────────────────
// Update a service area
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requirePermission(req, 'service-areas.manage');
  if (error) return error;

  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    // Check if area exists
    const existing = await query<ServiceArea[]>(
      `SELECT * FROM service_areas WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Service area not found' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { name, latitude, longitude, radiusMeters, city, status } = body;

    // Build update query dynamically
    const updates: string[] = [];
    const queryParams: (string | number | null)[] = [];

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Name must be a non-empty string' },
          { status: 400 }
        );
      }
      updates.push('name = ?');
      queryParams.push(name.trim());
    }

    if (latitude !== undefined) {
      if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
        return NextResponse.json(
          { error: 'Latitude must be between -90 and 90' },
          { status: 400 }
        );
      }
      updates.push('latitude = ?');
      queryParams.push(latitude);
    }

    if (longitude !== undefined) {
      if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
        return NextResponse.json(
          { error: 'Longitude must be between -180 and 180' },
          { status: 400 }
        );
      }
      updates.push('longitude = ?');
      queryParams.push(longitude);
    }

    if (radiusMeters !== undefined) {
      if (typeof radiusMeters !== 'number' || radiusMeters <= 0) {
        return NextResponse.json(
          { error: 'Radius must be a positive number' },
          { status: 400 }
        );
      }
      updates.push('radius_meters = ?');
      queryParams.push(Math.round(radiusMeters));
    }

    if (city !== undefined) {
      updates.push('city = ?');
      queryParams.push(city?.trim() || null);
    }

    if (status !== undefined) {
      if (!['active', 'disabled'].includes(status)) {
        return NextResponse.json(
          { error: 'Status must be "active" or "disabled"' },
          { status: 400 }
        );
      }
      updates.push('status = ?');
      queryParams.push(status);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Execute update
    queryParams.push(id);
    await query(
      `UPDATE service_areas SET ${updates.join(', ')} WHERE id = ?`,
      queryParams
    );

    // Fetch updated area
    const updated = await query<ServiceArea[]>(
      `SELECT * FROM service_areas WHERE id = ?`,
      [id]
    );

    // Log activity
    await query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'update', 'service_area', ?, ?)`,
      [user?.userId, id, JSON.stringify(body)]
    ).catch(() => {}); // Non-critical

    return NextResponse.json({
      message: 'Service area updated successfully',
      area: updated[0]
    });

  } catch (err) {
    console.error('[admin/service-areas/[id] PATCH] Error:', err);
    return NextResponse.json(
      { error: 'Failed to update service area' },
      { status: 500 }
    );
  }
}

// ── DELETE /api/admin/service-areas/[id] ──────────────────────────────────────
// Delete a service area
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requirePermission(req, 'service-areas.manage');
  if (error) return error;

  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    // Check if area exists
    const existing = await query<ServiceArea[]>(
      `SELECT * FROM service_areas WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Service area not found' },
        { status: 404 }
      );
    }

    // Delete the area
    await query(`DELETE FROM service_areas WHERE id = ?`, [id]);

    // Log activity
    await query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'delete', 'service_area', ?, ?)`,
      [user?.userId, id, JSON.stringify({ name: existing[0].name })]
    ).catch(() => {}); // Non-critical

    return NextResponse.json({
      message: 'Service area deleted successfully'
    });

  } catch (err) {
    console.error('[admin/service-areas/[id] DELETE] Error:', err);
    return NextResponse.json(
      { error: 'Failed to delete service area' },
      { status: 500 }
    );
  }
}
