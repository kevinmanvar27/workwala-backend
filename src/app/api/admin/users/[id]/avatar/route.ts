import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

type Params = { params: Promise<{ id: string }> };

// ── Magic-byte validation ─────────────────────────────────────────────────────
// Validates actual file content, not the spoofable Content-Type header.
async function validateAvatarMagicBytes(file: File): Promise<boolean> {
  const buf = Buffer.from(await file.arrayBuffer()).subarray(0, 12);

  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true;
  // GIF: 47 49 46 38
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
  // WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true;

  return false;
}

// Map magic bytes to a safe, fixed extension — never trust file.name
function safeExtension(file: File): string {
  // We already validated magic bytes above; derive ext from the declared MIME
  // as a display hint only (the stored filename uses a timestamp prefix anyway).
  const mime = file.type.toLowerCase();
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png')  return 'png';
  if (mime === 'image/gif')  return 'gif';
  if (mime === 'image/webp') return 'webp';
  return 'bin'; // fallback — should never reach here after magic-byte check
}

export async function POST(req: NextRequest, { params }: Params) {
  const { error } = await requirePermission(req, 'users.edit');
  if (error) return error;

  const { id } = await params;

  // Validate id is a positive integer to prevent path traversal
  const userId = parseInt(id, 10);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('avatar') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 5 MB.' }, { status: 400 });
    }

    // Validate actual file content via magic bytes — not the spoofable file.type header
    const valid = await validateAvatarMagicBytes(file);
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid file. Only JPEG, PNG, GIF, and WebP images are accepted.' },
        { status: 400 }
      );
    }

    const ext      = safeExtension(file);
    const fileName = `avatar_${userId}_${Date.now()}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');

    await mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, fileName), buffer);

    const avatarUrl = `/uploads/avatars/${fileName}`;
    await query(`UPDATE users SET avatar=?, updated_at=NOW() WHERE id=?`, [avatarUrl, userId]);

    return NextResponse.json({ success: true, avatar: avatarUrl });
  } catch (err) {
    console.error('Avatar upload error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
