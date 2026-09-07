import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';

// ── INTERFACES ────────────────────────────────────────────────────────────────
interface ServiceArea {
  id: number;
  name: string;
  status: 'active' | 'disabled';
}

// ── PATCH /api/admin/service-areas/[id]/toggle ────────────────────────────────
// Toggle service area status (active ↔ disabled)
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

    // Check if area exists and get current status
    const existing = await query<ServiceArea[]>(
      `SELECT id, name, status FROM service_areas WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Service area not found' },
        { status: 404 }
      );
    }

    const currentStatus = existing[0].status;
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';

    // Toggle status
    await query(
      `UPDATE service_areas SET status = ? WHERE id = ?`,
      [newStatus, id]
    );

    // Log activity
    await query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'toggle_status', 'service_area', ?, ?)`,
      [
        user?.userId,
        id,
        JSON.stringify({ 
          name: existing[0].name,
          from: currentStatus,
          to: newStatus
        })
      ]
    ).catch(() => {}); // Non-critical

    return NextResponse.json({
      message: `Service area ${newStatus === 'active' ? 'enabled' : 'disabled'} successfully`,
      status: newStatus
    });

  } catch (err) {
    console.error('[admin/service-areas/[id]/toggle PATCH] Error:', err);
    return NextResponse.json(
      { error: 'Failed to toggle service area status' },
      { status: 500 }
    );
  }
}
