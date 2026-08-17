import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// GET /api/admin/categories
export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, 'users.view');
  if (error) return error;

  try {
    const rows = await query<any[]>(
      `SELECT id, name, slug, description, price_per_hour, bg_color, border_color,
              is_active, sort_order, created_at, updated_at
       FROM categories
       WHERE deleted_at IS NULL
       ORDER BY sort_order ASC, id ASC`
    );
    return NextResponse.json({
      success: true,
      categories: rows.map((c) => ({ ...c, price_per_hour: parseFloat(c.price_per_hour) })),
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
    const body = await req.json();
    const { name, description, price_per_hour, bg_color, border_color, is_active, sort_order } = body;

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

    const result = await query<{ insertId: number }>(
      `INSERT INTO categories (name, slug, description, price_per_hour, bg_color, border_color, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        slug,
        description?.trim() || null,
        parseFloat(price_per_hour),
        bg_color || '#F0F5FF',
        border_color || '#6B9BFA',
        is_active === false ? 0 : 1,
        sort_order ?? 0,
      ]
    );
    return NextResponse.json({ success: true, id: result.insertId }, { status: 201 });
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
    const body = await req.json();
    const { id, name, description, price_per_hour, bg_color, border_color, is_active, sort_order } = body;

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
    if (price_per_hour !== undefined) { fields.push('price_per_hour = ?'); values.push(parseFloat(price_per_hour)); }
    if (bg_color !== undefined) { fields.push('bg_color = ?'); values.push(bg_color); }
    if (border_color !== undefined) { fields.push('border_color = ?'); values.push(border_color); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(sort_order); }

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
    await query('UPDATE categories SET deleted_at = NOW() WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('categories DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
