import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';

// GET /api/admin/activity-logs
export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, 'activity_logs.view');
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const search  = searchParams.get('search')  || '';
    const module  = searchParams.get('module')  || '';
    const action  = searchParams.get('action')  || '';
    const page    = parseInt(searchParams.get('page')  || '1');
    const limit   = parseInt(searchParams.get('limit') || '20');
    const offset  = (page - 1) * limit;

    const searchWild = `%${search}%`;

    // Build dynamic WHERE clauses
    const conditions: string[] = ['deleted_at IS NULL'];
    const bindings: (string | number)[] = [];

    if (search) {
      conditions.push('(user_name LIKE ? OR target_name LIKE ? OR description LIKE ? OR action LIKE ?)');
      bindings.push(searchWild, searchWild, searchWild, searchWild);
    }
    if (module) {
      conditions.push('module = ?');
      bindings.push(module);
    }
    if (action) {
      conditions.push('action = ?');
      bindings.push(action);
    }

    const where = conditions.join(' AND ');

    const logs = await query<{
      id: number;
      user_id: number | null;
      user_name: string;
      action: string;
      module: string;
      target_id: number | null;
      target_name: string | null;
      description: string | null;
      ip_address: string | null;
      created_at: string;
    }[]>(
      `SELECT id, user_id, user_name, action, module, target_id, target_name, description, ip_address, created_at
       FROM activity_logs
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...bindings, limit, offset]
    );

    const [totalRow] = await query<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM activity_logs WHERE ${where}`,
      bindings
    );

    // Distinct modules and actions for filter dropdowns
    const modules = await query<{ module: string }[]>(
      `SELECT DISTINCT module FROM activity_logs WHERE deleted_at IS NULL ORDER BY module`
    );
    const actions = await query<{ action: string }[]>(
      `SELECT DISTINCT action FROM activity_logs WHERE deleted_at IS NULL ORDER BY action`
    );

    return NextResponse.json({
      logs,
      total: totalRow.count,
      page,
      limit,
      modules: modules.map((m) => m.module),
      actions: actions.map((a) => a.action),
    });
  } catch (err) {
    console.error('Activity logs GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/activity-logs — clear all logs (soft delete)
export async function DELETE(req: NextRequest) {
  const { error } = await requirePermission(req, 'activity_logs.delete');
  if (error) return error;

  try {
    await query(`UPDATE activity_logs SET deleted_at = NOW() WHERE deleted_at IS NULL`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Activity logs DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
