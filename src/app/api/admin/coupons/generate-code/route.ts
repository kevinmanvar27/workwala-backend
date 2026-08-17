import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { query } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';

// POST /api/admin/coupons/generate-code — generate a unique coupon code
export async function POST(req: NextRequest) {
  const { error } = await requirePermission(req, 'coupons.create');
  if (error) return error;

  try {
    const body = await req.json().catch(() => ({}));
    const length = Math.min(Math.max(parseInt(body.length) || 8, 4), 20);
    const prefix = (body.prefix || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    let attempts = 0;

    do {
      const randomPart = Array.from({ length: length - prefix.length }, () =>
        chars[randomInt(0, chars.length)]
      ).join('');
      code = prefix + randomPart;
      attempts++;
      if (attempts > 30) {
        return NextResponse.json({ error: 'Could not generate a unique code' }, { status: 500 });
      }
      const existing = await query<{ id: number }[]>(
        'SELECT id FROM coupons WHERE code = ? AND deleted_at IS NULL',
        [code]
      );
      if (existing.length === 0) break;
    } while (true);

    return NextResponse.json({ success: true, code });
  } catch (err) {
    console.error('generate-code error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/coupons/check-code — check if a code is available
export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, 'coupons.create');
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const code = (searchParams.get('code') || '').toUpperCase().trim();
    const excludeId = searchParams.get('exclude_id');

    if (!code) return NextResponse.json({ available: false, error: 'Code is required' });

    const existing = await query<{ id: number }[]>(
      `SELECT id FROM coupons WHERE code = ? AND deleted_at IS NULL${excludeId ? ' AND id != ?' : ''}`,
      excludeId ? [code, excludeId] : [code]
    );

    return NextResponse.json({ available: existing.length === 0, code });
  } catch (err) {
    console.error('check-code error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
