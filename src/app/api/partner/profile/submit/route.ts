import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// Allowed MIME types for partner document uploads
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_DOC_TYPES   = [...ALLOWED_IMAGE_TYPES, 'application/pdf'];
// Max file size: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Validates a file's magic bytes against its declared MIME type.
 * Returns true if the file content matches an allowed type.
 */
async function validateFileMagicBytes(file: File, allowedTypes: string[]): Promise<boolean> {
  const bytes = await file.arrayBuffer();
  const buf = Buffer.from(bytes.slice(0, 8));

  // JPEG: FF D8 FF
  const isJpeg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const isPng  = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
  // WebP: RIFF....WEBP
  const isWebp = buf.slice(0, 4).toString('ascii') === 'RIFF';
  // PDF: %PDF
  const isPdf  = buf.slice(0, 4).toString('ascii') === '%PDF';

  if (isJpeg && allowedTypes.includes('image/jpeg')) return true;
  if (isPng  && allowedTypes.includes('image/png'))  return true;
  if (isWebp && allowedTypes.includes('image/webp')) return true;
  if (isPdf  && allowedTypes.includes('application/pdf')) return true;

  return false;
}

// POST /api/partner/profile/submit  (multipart/form-data)
export async function POST(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'partner');
    if (authError) return authError;

    const partnerId = payload.userId;

    const formData = await req.formData();

    // ── Text fields ──────────────────────────────────────────────────────────
    const name          = formData.get('name')?.toString()?.trim() || '';
    const gender        = formData.get('gender')?.toString() || '';
    const language      = formData.get('language')?.toString() || '';
    const categoriesRaw = formData.get('categories')?.toString() || '[]';
    const teamOption    = formData.get('team_option')?.toString() || '';
    const vehicleType   = formData.get('vehicle_type')?.toString() || '';

    if (!name || !gender || !language) {
      return NextResponse.json({ error: 'name, gender, and language are required' }, { status: 400 });
    }

    // Field length caps
    if (name.length > 100) {
      return NextResponse.json({ error: 'Name must be 100 characters or fewer' }, { status: 400 });
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

    async function saveFile(
      file: File,
      prefix: string,
      allowedTypes: string[]
    ): Promise<string | null> {
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File ${prefix} exceeds maximum size of 10 MB`);
      }
      // Validate magic bytes — do NOT trust Content-Type header
      const valid = await validateFileMagicBytes(file, allowedTypes);
      if (!valid) {
        throw new Error(`File ${prefix} has an invalid or unsupported format`);
      }
      // Use a safe extension derived from magic bytes, not the original filename
      const bytes = await file.arrayBuffer();
      const buf = Buffer.from(bytes);
      const magicByte = buf[0];
      let ext = 'bin';
      if (magicByte === 0xFF) ext = 'jpg';
      else if (magicByte === 0x89) ext = 'png';
      else if (buf.slice(0, 4).toString('ascii') === 'RIFF') ext = 'webp';
      else if (buf.slice(0, 4).toString('ascii') === '%PDF') ext = 'pdf';

      const fileName = `${prefix}_${Date.now()}.${ext}`;
      await writeFile(path.join(uploadDir, fileName), buf);
      return `/uploads/partners/${partnerId}/${fileName}`;
    }

    // ── Document files ───────────────────────────────────────────────────────
    const idFrontFile = formData.get('id_front') as File | null;
    const idBackFile  = formData.get('id_back')  as File | null;
    const selfieFile  = formData.get('selfie')   as File | null;
    const bankDocFile = formData.get('bank_doc') as File | null;

    let idFrontPath: string | null = null;
    let idBackPath:  string | null = null;
    let selfiePath:  string | null = null;
    let bankDocPath: string | null = null;

    try {
      if (idFrontFile && idFrontFile.size > 0) idFrontPath = await saveFile(idFrontFile, 'id_front', ALLOWED_DOC_TYPES);
      if (idBackFile  && idBackFile.size  > 0) idBackPath  = await saveFile(idBackFile,  'id_back',  ALLOWED_DOC_TYPES);
      if (selfieFile  && selfieFile.size  > 0) selfiePath  = await saveFile(selfieFile,  'selfie',   ALLOWED_IMAGE_TYPES);
      if (bankDocFile && bankDocFile.size > 0) bankDocPath = await saveFile(bankDocFile, 'bank_doc', ALLOWED_DOC_TYPES);
    } catch (fileErr: unknown) {
      const msg = fileErr instanceof Error ? fileErr.message : 'File validation failed';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

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
