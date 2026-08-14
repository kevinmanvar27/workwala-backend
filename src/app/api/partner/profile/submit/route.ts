import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// POST /api/partner/profile/submit  (multipart/form-data)
export async function POST(req: NextRequest) {
  try {
    // Authenticate partner via Bearer token
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const payload = verifyToken(token);
    if (!payload || payload.roleSlug !== 'partner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = payload.userId;

    const formData = await req.formData();

    // ── Text fields ──────────────────────────────────────────────────────────
    const name         = formData.get('name')?.toString()?.trim() || '';
    const gender       = formData.get('gender')?.toString() || '';
    const language     = formData.get('language')?.toString() || '';
    const categoriesRaw = formData.get('categories')?.toString() || '[]';
    const teamOption   = formData.get('team_option')?.toString() || '';
    const vehicleType  = formData.get('vehicle_type')?.toString() || '';

    if (!name || !gender || !language) {
      return NextResponse.json({ error: 'name, gender, and language are required' }, { status: 400 });
    }

    // Validate categories JSON
    let categories: string[] = [];
    try {
      categories = JSON.parse(categoriesRaw);
      if (!Array.isArray(categories)) categories = [];
    } catch {
      categories = [];
    }

    // ── File upload helper ───────────────────────────────────────────────────
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'partners', String(partnerId));
    await mkdir(uploadDir, { recursive: true });

    async function saveFile(file: File, prefix: string): Promise<string> {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${prefix}_${Date.now()}.${ext}`;
      const bytes = await file.arrayBuffer();
      await writeFile(path.join(uploadDir, fileName), Buffer.from(bytes));
      return `/uploads/partners/${partnerId}/${fileName}`;
    }

    // ── Document files ───────────────────────────────────────────────────────
    const idFrontFile  = formData.get('id_front')  as File | null;
    const idBackFile   = formData.get('id_back')   as File | null;
    const selfieFile   = formData.get('selfie')    as File | null;
    const bankDocFile  = formData.get('bank_doc')  as File | null;

    const idFrontPath  = idFrontFile  && idFrontFile.size  > 0 ? await saveFile(idFrontFile,  'id_front')  : null;
    const idBackPath   = idBackFile   && idBackFile.size   > 0 ? await saveFile(idBackFile,   'id_back')   : null;
    const selfiePath   = selfieFile   && selfieFile.size   > 0 ? await saveFile(selfieFile,   'selfie')    : null;
    const bankDocPath  = bankDocFile  && bankDocFile.size  > 0 ? await saveFile(bankDocFile,  'bank_doc')  : null;

    // ── Update partners table ────────────────────────────────────────────────
    await query(
      `UPDATE partners
       SET name = ?, gender = ?, language = ?, categories = ?,
           team_option = ?, vehicle_type = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, gender, language, JSON.stringify(categories), teamOption, vehicleType, partnerId]
    );

    // ── Upsert partner_documents ─────────────────────────────────────────────
    if (idFrontPath || idBackPath || selfiePath) {
      await query(
        `INSERT INTO partner_documents (partner_id, id_front, id_back, selfie)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           id_front = COALESCE(?, id_front),
           id_back  = COALESCE(?, id_back),
           selfie   = COALESCE(?, selfie),
           updated_at = NOW()`,
        [partnerId, idFrontPath, idBackPath, selfiePath,
         idFrontPath, idBackPath, selfiePath]
      );
    }

    // ── Upsert partner_bank_documents ────────────────────────────────────────
    if (bankDocPath) {
      await query(
        `INSERT INTO partner_bank_documents (partner_id, document_path)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE document_path = ?, updated_at = NOW()`,
        [partnerId, bankDocPath, bankDocPath]
      );
    }

    return NextResponse.json({ success: true, message: 'Profile submitted successfully' });
  } catch (err) {
    console.error('profile/submit error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
