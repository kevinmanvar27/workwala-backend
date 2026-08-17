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
    const status = searchParams.get('status') || 'all';
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

// POST /api/admin/partners — create a partner directly from admin
export async function POST(req: NextRequest) {
  const { error, user: actor } = await requirePermission(req, 'users.view');
  if (error) return error;

  try {
    const body = await req.json() as {
      phone: string;
      name?: string;
      gender?: string;
      language?: string;
      team_option?: string;
      vehicle_type?: string;
      categories?: string[];
      status?: string;
    };

    const { phone, name, gender, language, team_option, vehicle_type, categories, status } = body;

    // Phone is the only required field (it's the unique identifier / login key)
    if (!phone || !/^\d{10}$/.test(phone.replace(/\D/g, '').slice(-10))) {
      return NextResponse.json({ error: 'A valid 10-digit phone number is required' }, { status: 400 });
    }

    const VALID_STATUSES = ['pending', 'approved', 'rejected', 'suspended', 'inactive', 'banned'];
    const finalStatus = status && VALID_STATUSES.includes(status) ? status : 'approved';

    // Check for duplicate phone
    const existing = await query<{ id: number }[]>(
      `SELECT id FROM partners WHERE phone = ? AND deleted_at IS NULL LIMIT 1`,
      [phone]
    );
    if (existing.length > 0) {
      return NextResponse.json({ error: 'A partner with this phone number already exists' }, { status: 409 });
    }

    const result = await query<{ insertId: number }>(
      `INSERT INTO partners (phone, name, gender, language, team_option, vehicle_type, categories, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        phone,
        name?.trim()        || null,
        gender              || null,
        language?.trim()    || null,
        team_option         || null,
        vehicle_type?.trim()|| null,
        categories?.length  ? JSON.stringify(categories) : null,
        finalStatus,
      ]
    );

    await logActivity({
      userId: actor!.userId,
      userName: actor!.email,
      action: 'Created',
      module: 'partners',
      targetId: result.insertId,
      targetName: name?.trim() || phone,
      description: `Partner created by admin with status: ${finalStatus}`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true, id: result.insertId }, { status: 201 });
  } catch (err) {
    console.error('Partners POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/admin/partners — approve | reject | suspend | set status | edit fields
export async function PATCH(req: NextRequest) {
  const { error, user: actor } = await requirePermission(req, 'users.view');
  if (error) return error;

  try {
    const body = await req.json() as {
      id: number;
      action: 'approve' | 'reject' | 'set_status' | 'edit';
      status?: string;
      reason?: string;
      name?: string;
      phone?: string;
      gender?: string;
      language?: string;
      team_option?: string;
      vehicle_type?: string;
      categories?: string[];
    };

    const { id, action } = body;

    if (!id || !action) {
      return NextResponse.json({ error: 'id and action are required' }, { status: 400 });
    }

    const existing = await query<{ id: number; name: string; phone: string }[]>(
      `SELECT id, name, phone FROM partners WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const VALID_STATUSES = ['pending', 'approved', 'rejected', 'suspended', 'inactive', 'banned'];

    if (action === 'approve' || action === 'reject') {
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      await query(`UPDATE partners SET status = ?, updated_at = NOW() WHERE id = ?`, [newStatus, id]);
      await logActivity({
        userId: actor!.userId,
        userName: actor!.email,
        action: action === 'approve' ? 'Approved' : 'Rejected',
        module: 'partners',
        targetId: id,
        targetName: existing[0].name || existing[0].phone,
        description: body.reason || undefined,
        ipAddress: getClientIp(req),
      });
      return NextResponse.json({ success: true, status: newStatus });
    }

    if (action === 'set_status') {
      if (!body.status || !VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
      }
      await query(`UPDATE partners SET status = ?, updated_at = NOW() WHERE id = ?`, [body.status, id]);
      await logActivity({
        userId: actor!.userId,
        userName: actor!.email,
        action: 'Status Changed',
        module: 'partners',
        targetId: id,
        targetName: existing[0].name || existing[0].phone,
        description: `Status set to ${body.status}${body.reason ? ': ' + body.reason : ''}`,
        ipAddress: getClientIp(req),
      });
      return NextResponse.json({ success: true, status: body.status });
    }

    if (action === 'edit') {
      const { name, phone, gender, language, team_option, vehicle_type, categories, status } = body;

      if (status && !VALID_STATUSES.includes(status)) {
        return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
      }

      await query(
        `UPDATE partners SET
          name         = COALESCE(?, name),
          phone        = COALESCE(?, phone),
          gender       = COALESCE(?, gender),
          language     = COALESCE(?, language),
          team_option  = COALESCE(?, team_option),
          vehicle_type = COALESCE(?, vehicle_type),
          categories   = COALESCE(?, categories),
          status       = COALESCE(?, status),
          updated_at   = NOW()
         WHERE id = ?`,
        [
          name         ?? null,
          phone        ?? null,
          gender       ?? null,
          language     ?? null,
          team_option  ?? null,
          vehicle_type ?? null,
          categories   ? JSON.stringify(categories) : null,
          status       ?? null,
          id,
        ]
      );

      await logActivity({
        userId: actor!.userId,
        userName: actor!.email,
        action: 'Edited',
        module: 'partners',
        targetId: id,
        targetName: name || existing[0].name || existing[0].phone,
        ipAddress: getClientIp(req),
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('Partners PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
