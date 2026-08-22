import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';

// ── File upload helpers ────────────────────────────────────────────────────────
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

async function validateFileMagicBytes(file: File, allowedTypes: string[]): Promise<boolean> {
  const bytes = await file.arrayBuffer();
  const buf = Buffer.from(bytes.slice(0, 8));
  const isJpeg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
  const isPng  = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
  const isWebp = buf.slice(0, 4).toString('ascii') === 'RIFF';
  const isSvg  = buf.toString('utf8', 0, 5).includes('<svg') || buf.toString('utf8', 0, 5).includes('<?xml');
  
  if (isJpeg && allowedTypes.includes('image/jpeg')) return true;
  if (isPng  && allowedTypes.includes('image/png'))  return true;
  if (isWebp && allowedTypes.includes('image/webp')) return true;
  if (isSvg  && allowedTypes.includes('image/svg+xml')) return true;
  return false;
}

async function saveIconFile(
  file: File,
  categoryId: number | string,
  allowedTypes: string[]
): Promise<string> {
  if (file.size > MAX_FILE_SIZE) throw new Error('Icon file exceeds 10 MB limit');
  const valid = await validateFileMagicBytes(file, allowedTypes);
  if (!valid) throw new Error('Icon file has an invalid or unsupported format');

  const bytes = await file.arrayBuffer();
  const buf   = Buffer.from(bytes);
  
  // Determine extension
  let ext = 'bin';
  if (buf[0] === 0xFF) ext = 'jpg';
  else if (buf[0] === 0x89) ext = 'png';
  else if (buf.slice(0, 4).toString('ascii') === 'RIFF') ext = 'webp';
  else if (buf.toString('utf8', 0, 100).includes('<svg') || buf.toString('utf8', 0, 100).includes('<?xml')) ext = 'svg';

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'categories');
  await mkdir(uploadDir, { recursive: true });

  const fileName = `${categoryId}-icon_${Date.now()}.${ext}`;
  await writeFile(path.join(uploadDir, fileName), buf);
  return `/uploads/categories/${fileName}`;
}

async function deleteOldIcon(iconPath: string | null) {
  if (!iconPath) return;
  try {
    const fullPath = path.join(process.cwd(), 'public', iconPath);
    await unlink(fullPath);
  } catch (err) {
    console.warn('Failed to delete old icon:', err);
  }
}

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// GET /api/admin/categories
export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, 'users.view');
  if (error) return error;

  try {
    const rows = await query<any[]>(
      `SELECT id, name, slug, description, price_per_hour, icon_path, icon_color,
              bg_color, border_color, is_active, sort_order, created_at, updated_at
       FROM categories
       WHERE deleted_at IS NULL
       ORDER BY sort_order ASC, id ASC`
    );
    return NextResponse.json({
      success: true,
      categories: rows.map((c) => ({ 
        ...c, 
        price_per_hour: parseFloat(c.price_per_hour),
        icon_path: c.icon_path || null,
        icon_color: c.icon_color || null,
      })),
    });
  } catch (err) {
    console.error('categories GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/categories — create
export async function POST(req: NextRequest) {
  const { error } = await requirePermission(req, 'users.view');
  if (error) return error;

  try {
    const contentType = req.headers.get('content-type') || '';
    let name: string, description: string | null, price_per_hour: number;
    let bg_color: string, border_color: string, is_active: boolean, sort_order: number;
    let icon_color: string | null = null;
    let icon_path: string | null = null;
    let iconFile: File | null = null;

    // Handle both JSON and multipart/form-data
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      name = formData.get('name') as string;
      description = (formData.get('description') as string) || null;
      price_per_hour = parseFloat(formData.get('price_per_hour') as string);
      bg_color = (formData.get('bg_color') as string) || '#F0F5FF';
      border_color = (formData.get('border_color') as string) || '#6B9BFA';
      is_active = formData.get('is_active') === 'true';
      sort_order = parseInt(formData.get('sort_order') as string) || 0;
      icon_color = (formData.get('icon_color') as string) || null;
      iconFile = formData.get('icon') as File | null;
    } else {
      const body = await req.json();
      ({ name, description, price_per_hour, bg_color, border_color, is_active, sort_order, icon_color, icon_path } = body);
      bg_color = bg_color || '#F0F5FF';
      border_color = border_color || '#6B9BFA';
      is_active = is_active !== false;
      sort_order = sort_order ?? 0;
    }

    if (!name || price_per_hour === undefined || price_per_hour === null) {
      return NextResponse.json({ error: 'name and price_per_hour are required' }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json({ error: 'Name must be 100 characters or fewer' }, { status: 400 });
    }

    const slug = slugify(name);
    const existing = await query<any[]>(
      'SELECT id FROM categories WHERE slug = ? AND deleted_at IS NULL',
      [slug]
    );
    if (existing.length > 0) {
      return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 });
    }

    // Insert category first to get ID
    const result = await query<{ insertId: number }>(
      `INSERT INTO categories (name, slug, description, price_per_hour, bg_color, border_color, is_active, sort_order, icon_color, icon_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        slug,
        description?.trim() || null,
        parseFloat(String(price_per_hour)),
        bg_color,
        border_color,
        is_active ? 1 : 0,
        sort_order,
        icon_color,
        icon_path,
      ]
    );

    const categoryId = result.insertId;

    // Handle icon upload if provided
    if (iconFile && iconFile.size > 0) {
      try {
        const iconPath = await saveIconFile(iconFile, categoryId, ALLOWED_IMAGE_TYPES);
        await query(
          'UPDATE categories SET icon_path = ? WHERE id = ?',
          [iconPath, categoryId]
        );
      } catch (fileErr: any) {
        console.error('Icon upload error:', fileErr);
        return NextResponse.json({ error: fileErr.message || 'Icon upload failed' }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true, id: categoryId }, { status: 201 });
  } catch (err) {
    console.error('categories POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/admin/categories — update
export async function PATCH(req: NextRequest) {
  const { error } = await requirePermission(req, 'users.view');
  if (error) return error;

  try {
    const contentType = req.headers.get('content-type') || '';
    let id: number;
    let name: string | undefined, description: string | undefined, price_per_hour: number | undefined;
    let bg_color: string | undefined, border_color: string | undefined;
    let is_active: boolean | undefined, sort_order: number | undefined;
    let icon_color: string | undefined | null;
    let icon_path: string | undefined | null;
    let iconFile: File | null = null;

    // Handle both JSON and multipart/form-data
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      id = parseInt(formData.get('id') as string);
      name = formData.get('name') as string | undefined;
      description = formData.get('description') as string | undefined;
      const priceStr = formData.get('price_per_hour') as string | undefined;
      price_per_hour = priceStr ? parseFloat(priceStr) : undefined;
      bg_color = formData.get('bg_color') as string | undefined;
      border_color = formData.get('border_color') as string | undefined;
      const activeStr = formData.get('is_active') as string | undefined;
      is_active = activeStr !== undefined ? activeStr === 'true' : undefined;
      const sortStr = formData.get('sort_order') as string | undefined;
      sort_order = sortStr ? parseInt(sortStr) : undefined;
      icon_color = formData.get('icon_color') as string | undefined | null;
      iconFile = formData.get('icon') as File | null;
    } else {
      const body = await req.json();
      ({ id, name, description, price_per_hour, bg_color, border_color, is_active, sort_order, icon_color, icon_path } = body);
    }

    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    // Length cap on update — same rule as create
    if (name !== undefined && name.length > 100) {
      return NextResponse.json({ error: 'Name must be 100 characters or fewer' }, { status: 400 });
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      fields.push('name = ?', 'slug = ?');
      values.push(name.trim(), slugify(name));
    }
    if (description !== undefined) { fields.push('description = ?'); values.push(description?.trim() || null); }
    if (price_per_hour !== undefined) { fields.push('price_per_hour = ?'); values.push(parseFloat(String(price_per_hour))); }
    if (bg_color !== undefined) { fields.push('bg_color = ?'); values.push(bg_color); }
    if (border_color !== undefined) { fields.push('border_color = ?'); values.push(border_color); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(sort_order); }
    if (icon_color !== undefined) { fields.push('icon_color = ?'); values.push(icon_color); }
    if (icon_path !== undefined) { fields.push('icon_path = ?'); values.push(icon_path); }

    // Handle icon upload if provided
    if (iconFile && iconFile.size > 0) {
      try {
        // Get old icon path to delete it
        const [oldCategory] = await query<{ icon_path: string | null }[]>(
          'SELECT icon_path FROM categories WHERE id = ?',
          [id]
        );
        
        const iconPath = await saveIconFile(iconFile, id, ALLOWED_IMAGE_TYPES);
        fields.push('icon_path = ?');
        values.push(iconPath);

        // Delete old icon after successful upload
        if (oldCategory && oldCategory.icon_path) {
          await deleteOldIcon(oldCategory.icon_path);
        }
      } catch (fileErr: any) {
        console.error('Icon upload error:', fileErr);
        return NextResponse.json({ error: fileErr.message || 'Icon upload failed' }, { status: 400 });
      }
    }

    if (fields.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    values.push(id);
    await query(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, values);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('categories PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/categories — soft delete
export async function DELETE(req: NextRequest) {
  const { error } = await requirePermission(req, 'users.view');
  if (error) return error;

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    
    // Get icon path before soft delete (we'll keep the file for potential recovery)
    // If you want to delete the file immediately, uncomment the lines below
    // const [category] = await query<{ icon_path: string | null }[]>(
    //   'SELECT icon_path FROM categories WHERE id = ?',
    //   [id]
    // );
    // if (category && category.icon_path) {
    //   await deleteOldIcon(category.icon_path);
    // }
    
    await query('UPDATE categories SET deleted_at = NOW() WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('categories DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
