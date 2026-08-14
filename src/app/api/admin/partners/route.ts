import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { logActivity, getClientIp } from '@/lib/activityLogger';

// GET /api/admin/partners — list partners, filterable by status
export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, 'users.view');
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all'; // all | pending | approved | rejected
    const page   = parseInt(searchParams.get('page')  || '1');
    const limit  = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    const searchWild = `%${search}%`;

    const statusFilter = status !== 'all' ? `AND p.status = ?` : '';
    const params: (string | number)[] = [searchWild, searchWild];
    if (status !== 'all') params.push(status);
    params.push(limit, offset);

    const partners = await query<{
      id: number; phone: string; name: string; gender: string;
      language: string; categories: string; team_option: string;
      vehicle_type: string; status: string; created_at: string;
      id_front: string | null; id_back: string | null; selfie: string | null;
      bank_document: string | null;
    }[]>(
      `SELECT p.id, p.phone, p.name, p.gender, p.language, p.categories,
              p.team_option, p.vehicle_type, p.status, p.created_at,
              pd.id_front, pd.id_back, pd.selfie,
              pb.document_path AS bank_document
       FROM partners p
       LEFT JOIN partner_documents pd ON pd.partner_id = p.id
       LEFT JOIN partner_bank_documents pb ON pb.partner_id = p.id
       WHERE p.deleted_at IS NULL
         AND (p.name LIKE ? OR p.phone LIKE ?)
         ${statusFilter}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      params
    );

    const countParams: (string | number)[] = [searchWild, searchWild];
    if (status !== 'all') countParams.push(status);

    const [total] = await query<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM partners p
       WHERE p.deleted_at IS NULL
         AND (p.name LIKE ? OR p.phone LIKE ?)
         ${statusFilter}`,
      countParams
    );

    // Parse categories JSON safely
    const rows = partners.map((p) => ({
      ...p,
      categories: (() => {
        try { return JSON.parse(p.categories || '[]'); } catch { return []; }
      })(),
    }));

    return NextResponse.json({ partners: rows, total: total.count, page, limit });
  } catch (err) {
    console.error('Partners GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/admin/partners — approve or reject a partner
export async function PATCH(req: NextRequest) {
  const { error, user: actor } = await requirePermission(req, 'users.view');
  if (error) return error;

  try {
    const { id, action, reason } = await req.json() as {
      id: number; action: 'approve' | 'reject'; reason?: string;
    };

    if (!id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'id and action (approve|reject) are required' }, { status: 400 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const existing = await query<{ id: number; name: string; phone: string }[]>(
      `SELECT id, name, phone FROM partners WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    await query(
      `UPDATE partners SET status = ?, updated_at = NOW() WHERE id = ?`,
      [newStatus, id]
    );

    await logActivity({
      userId: actor!.userId,
      userName: actor!.email,
      action: action === 'approve' ? 'Approved' : 'Rejected',
      module: 'partners',
      targetId: id,
      targetName: existing[0].name || existing[0].phone,
      description: reason || undefined,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true, status: newStatus });
  } catch (err) {
    console.error('Partners PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
