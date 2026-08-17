import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getClientIp } from '@/lib/activityLogger';

// ── Rate limiting ─────────────────────────────────────────────────────────────
const serviceDetailHits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT  = 60;
const RATE_WINDOW = 60_000;

function checkRateLimit(ip: string): boolean {
  const now    = Date.now();
  const record = serviceDetailHits.get(ip);
  if (!record || now > record.resetAt) {
    serviceDetailHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (record.count >= RATE_LIMIT) return false;
  record.count += 1;
  return true;
}

type Params = { params: Promise<{ id: string }> };

// GET /api/customer/services/:id
// Public — returns a single active service by ID.
// Used by BookingFunnelScreen to fetch live price/name before confirming.
export async function GET(req: NextRequest, { params }: Params) {
  const ip = getClientIp(req) ?? 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id) || id <= 0) {
      return NextResponse.json({ error: 'Invalid service id' }, { status: 400 });
    }

    const rows = await query<{
      id: number;
      svc_name: string;
      svc_slug: string;
      svc_price: string;
      svc_bg: string;
      svc_border: string;
      cat_name: string | null;
      cat_slug: string | null;
      cat_price: string | null;
      cat_bg: string | null;
      cat_border: string | null;
    }[]>(
      `SELECT
         s.id,
         s.name           AS svc_name,
         s.slug           AS svc_slug,
         s.price_per_hour AS svc_price,
         s.bg_color       AS svc_bg,
         s.border_color   AS svc_border,
         c.name           AS cat_name,
         c.slug           AS cat_slug,
         c.price_per_hour AS cat_price,
         c.bg_color       AS cat_bg,
         c.border_color   AS cat_border
       FROM services s
       LEFT JOIN categories c ON c.id = s.category_id AND c.deleted_at IS NULL
       WHERE s.id = ?
         AND s.is_active = 1
         AND s.deleted_at IS NULL
         AND (s.category_id IS NULL OR c.is_active = 1)
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Service not found or inactive' }, { status: 404 });
    }

    const s = rows[0];
    return NextResponse.json({
      success:       true,
      id:            s.id,
      name:          s.cat_name   ?? s.svc_name,
      slug:          s.cat_slug   ?? s.svc_slug,
      price_per_hour: parseFloat(s.cat_price ?? s.svc_price),
      bg_color:      s.cat_bg     ?? s.svc_bg,
      border_color:  s.cat_border ?? s.svc_border,
    });
  } catch (err) {
    console.error('customer services/:id error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
