import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { logActivity, getClientIp } from '@/lib/activityLogger';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// ── File upload helpers ────────────────────────────────────────────────────────
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_DOC_TYPES   = [...ALLOWED_IMAGE_TYPES, 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ── Team option validator ──────────────────────────────────────────────────────
/**
 * Validates and normalizes team_option to match ENUM('yes','no') in database
 * @param value - The raw team_option value from request
 * @returns 'yes', 'no', or null
 * @throws Error if value is invalid
 */
function normalizeTeamOption(value: string | undefined | null): 'yes' | 'no' | null {
  if (!value || value.trim() === '') {
    return null;
  }
  
  const normalized = value.toLowerCase().trim();
  
  // Accept 'yes', 'true', '1' as 'yes'
  if (normalized === 'yes' || normalized === 'true' || normalized === '1') {
    return 'yes';
  }
  
  // Accept 'no', 'false', '0' as 'no'
  if (normalized === 'no' || normalized === 'false' || normalized === '0') {
    return 'no';
  }
  
  // Invalid value
  throw new Error(`team_option must be 'yes' or 'no' (received: '${value}')`);
}

async function validateFileMagicBytes(file: File, allowedTypes: string[]): Promise<boolean> {
  const bytes = await file.arrayBuffer();
  const buf = Buffer.from(bytes.slice(0, 8));
  const isJpeg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
  const isPng  = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
  const isWebp = buf.slice(0, 4).toString('ascii') === 'RIFF';
  const isPdf  = buf.slice(0, 4).toString('ascii') === '%PDF';
  if (isJpeg && allowedTypes.includes('image/jpeg')) return true;
  if (isPng  && allowedTypes.includes('image/png'))  return true;
  if (isWebp && allowedTypes.includes('image/webp')) return true;
  if (isPdf  && allowedTypes.includes('application/pdf')) return true;
  return false;
}

async function saveFile(
  file: File,
  partnerId: number | string,
  prefix: string,
  allowedTypes: string[]
): Promise<string> {
  if (file.size > MAX_FILE_SIZE) throw new Error(`${prefix} exceeds 10 MB limit`);
  const valid = await validateFileMagicBytes(file, allowedTypes);
  if (!valid) throw new Error(`${prefix} has an invalid or unsupported format`);

  const bytes = await file.arrayBuffer();
  const buf   = Buffer.from(bytes);
  const b0    = buf[0];
  let ext = 'bin';
  if (b0 === 0xFF) ext = 'jpg';
  else if (b0 === 0x89) ext = 'png';
  else if (buf.slice(0, 4).toString('ascii') === 'RIFF') ext = 'webp';
  else if (buf.slice(0, 4).toString('ascii') === '%PDF') ext = 'pdf';

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'partners', String(partnerId));
  await mkdir(uploadDir, { recursive: true });

  const fileName = `${prefix}_${Date.now()}.${ext}`;
  await writeFile(path.join(uploadDir, fileName), buf);
  return `/uploads/partners/${partnerId}/${fileName}`;
}

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
      bank_document: string | null; fcm_token: string | null;
    }[]>(
      `SELECT p.id, p.phone, p.name, p.gender, p.language, p.categories,
              p.team_option, p.vehicle_type, p.status, p.created_at,
              pd.id_front, pd.id_back, pd.selfie,
              pb.document_path AS bank_document,
              p.fcm_token
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

// POST /api/admin/partners — create a partner (multipart/form-data with optional documents)
export async function POST(req: NextRequest) {
  const { error, user: actor } = await requirePermission(req, 'users.view');
  if (error) return error;

  try {
    // Support both JSON and multipart/form-data
    const contentType = req.headers.get('content-type') || '';
    let phone = '', name = '', gender = '', language = '', team_option = '',
        vehicle_type = '', status = '', categories: string[] = [];
    let idFrontFile: File | null = null, idBackFile: File | null = null,
        selfieFile: File | null = null, bankDocFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      phone        = formData.get('phone')?.toString() || '';
      name         = formData.get('name')?.toString()?.trim() || '';
      gender       = formData.get('gender')?.toString() || '';
      language     = formData.get('language')?.toString() || '';
      team_option  = formData.get('team_option')?.toString() || '';
      vehicle_type = formData.get('vehicle_type')?.toString() || '';
      status       = formData.get('status')?.toString() || '';
      
      // Categories can be sent as multiple entries or JSON array
      const catEntries = formData.getAll('categories');
      if (catEntries.length > 0) {
        categories = catEntries.map(c => c.toString()).filter(Boolean);
      }
      
      idFrontFile = formData.get('aadhaar_front') as File | null;
      idBackFile  = formData.get('aadhaar_back')  as File | null;
      selfieFile  = formData.get('profile_photo') as File | null;
      bankDocFile = formData.get('bank_doc')      as File | null;
    } else {
      const body = await req.json();
      phone        = body.phone || '';
      name         = body.name?.trim() || '';
      gender       = body.gender || '';
      language     = body.language?.trim() || '';
      team_option  = body.team_option || '';
      vehicle_type = body.vehicle_type?.trim() || '';
      status       = body.status || '';
      categories   = Array.isArray(body.categories) ? body.categories : [];
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      return NextResponse.json({ error: 'A valid 10-digit phone number is required' }, { status: 400 });
    }

    const VALID_STATUSES = ['pending', 'approved', 'rejected', 'suspended', 'inactive', 'banned'];
    const finalStatus = status && VALID_STATUSES.includes(status) ? status : 'approved';

    // Validate and normalize team_option
    let normalizedTeamOption: 'yes' | 'no' | null = null;
    try {
      normalizedTeamOption = normalizeTeamOption(team_option);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid team_option value';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const existing = await query<{ id: number }[]>(
      `SELECT id FROM partners WHERE phone = ? AND deleted_at IS NULL LIMIT 1`,
      [cleanPhone]
    );
    if (existing.length > 0) {
      return NextResponse.json({ error: 'A partner with this phone number already exists' }, { status: 409 });
    }

    const result = await query<{ insertId: number }>(
      `INSERT INTO partners (phone, name, gender, language, team_option, vehicle_type, categories, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cleanPhone,
        name         || null,
        gender       || null,
        language     || null,
        normalizedTeamOption,
        vehicle_type || null,
        categories.length ? JSON.stringify(categories) : null,
        finalStatus,
      ]
    );

    const partnerId = result.insertId;

    // ── Upload documents if provided ─────────────────────────────────────────
    let idFrontPath: string | null = null, idBackPath: string | null = null,
        selfiePath: string | null = null, bankDocPath: string | null = null;

    try {
      if (idFrontFile && idFrontFile.size > 0) idFrontPath = await saveFile(idFrontFile, partnerId, 'aadhaar_front', ALLOWED_DOC_TYPES);
      if (idBackFile  && idBackFile.size  > 0) idBackPath  = await saveFile(idBackFile,  partnerId, 'aadhaar_back',  ALLOWED_DOC_TYPES);
      if (selfieFile  && selfieFile.size  > 0) selfiePath  = await saveFile(selfieFile,  partnerId, 'profile_photo', ALLOWED_IMAGE_TYPES);
      if (bankDocFile && bankDocFile.size > 0) bankDocPath = await saveFile(bankDocFile, partnerId, 'pan_card',      ALLOWED_DOC_TYPES);
    } catch (fileErr: unknown) {
      const msg = fileErr instanceof Error ? fileErr.message : 'File validation failed';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (idFrontPath || idBackPath || selfiePath) {
      await query(
        `INSERT INTO partner_documents (partner_id, id_front, id_back, selfie)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           id_front = COALESCE(?, id_front),
           id_back  = COALESCE(?, id_back),
           selfie   = COALESCE(?, selfie),
           updated_at = NOW()`,
        [partnerId, idFrontPath, idBackPath, selfiePath, idFrontPath, idBackPath, selfiePath]
      );
    }

    if (bankDocPath) {
      await query(
        `INSERT INTO partner_bank_documents (partner_id, document_path)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE document_path = ?, updated_at = NOW()`,
        [partnerId, bankDocPath, bankDocPath]
      );
    }

    await logActivity({
      userId: actor!.userId,
      userName: actor!.email,
      action: 'Created',
      module: 'partners',
      targetId: partnerId,
      targetName: name || cleanPhone,
      description: `Partner created by admin with status: ${finalStatus}`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true, id: partnerId }, { status: 201 });
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
    // Support both JSON and multipart/form-data
    const contentType = req.headers.get('content-type') || '';
    let id: number = 0, action = '', status = '', reason = '', name = '', phone = '',
        gender = '', language = '', team_option = '', vehicle_type = '', categories: string[] = [];
    let aadhaarFrontFile: File | null = null, aadhaarBackFile: File | null = null,
        panCardFile: File | null = null, profilePhotoFile: File | null = null,
        bankDocFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      id           = parseInt(formData.get('id')?.toString() || '0');
      action       = formData.get('action')?.toString() || '';
      status       = formData.get('status')?.toString() || '';
      reason       = formData.get('reason')?.toString() || '';
      name         = formData.get('name')?.toString()?.trim() || '';
      phone        = formData.get('phone')?.toString() || '';
      gender       = formData.get('gender')?.toString() || '';
      language     = formData.get('language')?.toString() || '';
      team_option  = formData.get('team_option')?.toString() || '';
      vehicle_type = formData.get('vehicle_type')?.toString() || '';
      
      // Categories can be sent as multiple entries or JSON array
      const catEntries = formData.getAll('categories');
      if (catEntries.length > 0) {
        categories = catEntries.map(c => c.toString()).filter(Boolean);
      }
      
      aadhaarFrontFile  = formData.get('aadhaar_front') as File | null;
      aadhaarBackFile   = formData.get('aadhaar_back')  as File | null;
      panCardFile       = formData.get('pan_card')      as File | null;
      profilePhotoFile  = formData.get('profile_photo') as File | null;
      bankDocFile       = formData.get('bank_doc')      as File | null;
    } else {
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
      id           = body.id;
      action       = body.action;
      status       = body.status || '';
      reason       = body.reason || '';
      name         = body.name || '';
      phone        = body.phone || '';
      gender       = body.gender || '';
      language     = body.language || '';
      team_option  = body.team_option || '';
      vehicle_type = body.vehicle_type || '';
      categories   = body.categories || [];
    }

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
        description: reason || undefined,
        ipAddress: getClientIp(req),
      });
      return NextResponse.json({ success: true, status: newStatus });
    }

    if (action === 'set_status') {
      if (!status || !VALID_STATUSES.includes(status)) {
        return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
      }
      await query(`UPDATE partners SET status = ?, updated_at = NOW() WHERE id = ?`, [status, id]);
      await logActivity({
        userId: actor!.userId,
        userName: actor!.email,
        action: 'Status Changed',
        module: 'partners',
        targetId: id,
        targetName: existing[0].name || existing[0].phone,
        description: `Status set to ${status}${reason ? ': ' + reason : ''}`,
        ipAddress: getClientIp(req),
      });
      return NextResponse.json({ success: true, status: status });
    }

    if (action === 'edit') {
      if (status && !VALID_STATUSES.includes(status)) {
        return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
      }

      // Validate and normalize team_option
      let normalizedTeamOption: 'yes' | 'no' | null = null;
      try {
        normalizedTeamOption = normalizeTeamOption(team_option);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Invalid team_option value';
        return NextResponse.json({ error: msg }, { status: 400 });
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
          name         || null,
          phone        || null,
          gender       || null,
          language     || null,
          normalizedTeamOption,
          vehicle_type || null,
          categories.length > 0 ? JSON.stringify(categories) : null,
          status       || null,
          id,
        ]
      );

      // Handle document uploads if present
      if (aadhaarFrontFile || aadhaarBackFile || panCardFile || profilePhotoFile || bankDocFile) {
        let aadhaarFrontPath: string | null = null;
        let aadhaarBackPath: string | null = null;
        let panCardPath: string | null = null;
        let profilePhotoPath: string | null = null;
        let bankDocPath: string | null = null;

        try {
          if (aadhaarFrontFile && aadhaarFrontFile.size > 0) {
            aadhaarFrontPath = await saveFile(aadhaarFrontFile, id, 'aadhaar_front', ALLOWED_DOC_TYPES);
          }
          if (aadhaarBackFile && aadhaarBackFile.size > 0) {
            aadhaarBackPath = await saveFile(aadhaarBackFile, id, 'aadhaar_back', ALLOWED_DOC_TYPES);
          }
          if (panCardFile && panCardFile.size > 0) {
            panCardPath = await saveFile(panCardFile, id, 'pan_card', ALLOWED_DOC_TYPES);
          }
          if (profilePhotoFile && profilePhotoFile.size > 0) {
            profilePhotoPath = await saveFile(profilePhotoFile, id, 'profile_photo', ALLOWED_IMAGE_TYPES);
          }
          if (bankDocFile && bankDocFile.size > 0) {
            bankDocPath = await saveFile(bankDocFile, id, 'bank_doc', ALLOWED_DOC_TYPES);
          }
        } catch (fileErr: unknown) {
          const msg = fileErr instanceof Error ? fileErr.message : 'File validation failed';
          return NextResponse.json({ error: msg }, { status: 400 });
        }

        // Update partner_documents table
        if (aadhaarFrontPath || aadhaarBackPath || panCardPath || profilePhotoPath) {
          await query(
            `INSERT INTO partner_documents (partner_id, id_front, id_back, selfie)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               id_front = COALESCE(?, id_front),
               id_back  = COALESCE(?, id_back),
               selfie   = COALESCE(?, selfie),
               updated_at = NOW()`,
            [id, aadhaarFrontPath, aadhaarBackPath, profilePhotoPath, 
             aadhaarFrontPath, aadhaarBackPath, profilePhotoPath]
          );
        }

        // Update partner_bank_documents table
        if (bankDocPath) {
          await query(
            `INSERT INTO partner_bank_documents (partner_id, document_path)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE document_path = ?, updated_at = NOW()`,
            [id, bankDocPath, bankDocPath]
          );
        }
      }

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

// PUT /api/admin/partners — upload/replace documents for an existing partner
export async function PUT(req: NextRequest) {
  const { error, user: actor } = await requirePermission(req, 'users.view');
  if (error) return error;

  try {
    const formData  = await req.formData();
    const idStr     = formData.get('partner_id')?.toString();
    const partnerId = idStr ? parseInt(idStr) : NaN;

    if (!partnerId || isNaN(partnerId)) {
      return NextResponse.json({ error: 'partner_id is required' }, { status: 400 });
    }

    const existing = await query<{ id: number; name: string; phone: string }[]>(
      `SELECT id, name, phone FROM partners WHERE id = ? AND deleted_at IS NULL`,
      [partnerId]
    );
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const idFrontFile = formData.get('id_front') as File | null;
    const idBackFile  = formData.get('id_back')  as File | null;
    const selfieFile  = formData.get('selfie')   as File | null;
    const bankDocFile = formData.get('bank_doc') as File | null;

    if (!idFrontFile && !idBackFile && !selfieFile && !bankDocFile) {
      return NextResponse.json({ error: 'At least one document file is required' }, { status: 400 });
    }

    let idFrontPath: string | null = null, idBackPath: string | null = null,
        selfiePath: string | null = null, bankDocPath: string | null = null;

    try {
      if (idFrontFile && idFrontFile.size > 0) idFrontPath = await saveFile(idFrontFile, partnerId, 'id_front', ALLOWED_DOC_TYPES);
      if (idBackFile  && idBackFile.size  > 0) idBackPath  = await saveFile(idBackFile,  partnerId, 'id_back',  ALLOWED_DOC_TYPES);
      if (selfieFile  && selfieFile.size  > 0) selfiePath  = await saveFile(selfieFile,  partnerId, 'selfie',   ALLOWED_IMAGE_TYPES);
      if (bankDocFile && bankDocFile.size > 0) bankDocPath = await saveFile(bankDocFile, partnerId, 'bank_doc', ALLOWED_DOC_TYPES);
    } catch (fileErr: unknown) {
      const msg = fileErr instanceof Error ? fileErr.message : 'File validation failed';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (idFrontPath || idBackPath || selfiePath) {
      await query(
        `INSERT INTO partner_documents (partner_id, id_front, id_back, selfie)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           id_front = COALESCE(?, id_front),
           id_back  = COALESCE(?, id_back),
           selfie   = COALESCE(?, selfie),
           updated_at = NOW()`,
        [partnerId, idFrontPath, idBackPath, selfiePath, idFrontPath, idBackPath, selfiePath]
      );
    }

    if (bankDocPath) {
      await query(
        `INSERT INTO partner_bank_documents (partner_id, document_path)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE document_path = ?, updated_at = NOW()`,
        [partnerId, bankDocPath, bankDocPath]
      );
    }

    await logActivity({
      userId: actor!.userId,
      userName: actor!.email,
      action: 'Documents Updated',
      module: 'partners',
      targetId: partnerId,
      targetName: existing[0].name || existing[0].phone,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true, id_front: idFrontPath, id_back: idBackPath, selfie: selfiePath, bank_document: bankDocPath });
  } catch (err) {
    console.error('Partners PUT error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
