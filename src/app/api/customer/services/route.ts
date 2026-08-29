import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getClientIp } from '@/lib/activityLogger';

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Prevents automated enumeration of the service catalogue.
// In-process store — replace with Redis for multi-instance deployments.
const serviceListHits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT    = 60;           // max 60 requests
const RATE_WINDOW   = 60_000;       // per 60 seconds per IP

function checkServiceRateLimit(ip: string): boolean {
  const now    = Date.now();
  const record = serviceListHits.get(ip);
  if (!record || now > record.resetAt) {
    serviceListHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (record.count >= RATE_LIMIT) return false;
  record.count += 1;
  return true;
}

// GET /api/customer/services
// Public — returns all active services.
// When a service is linked to a category, ALL display fields (name, slug,
// price_per_hour, bg_color, border_color) come from the category so that
// admin edits are reflected immediately. Falls back to service-level values
// when no category is linked.
export async function GET(req: NextRequest) {
  const ip = getClientIp(req) ?? 'unknown';
  if (!checkServiceRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  try {
    const services = await query<{
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
      cat_icon_path: string | null;
      cat_icon_color: string | null;
      sort_order: number;
    }[]>(
      `SELECT
         s.id,
         s.name            AS svc_name,
         s.slug            AS svc_slug,
         s.price_per_hour  AS svc_price,
         s.bg_color        AS svc_bg,
         s.border_color    AS svc_border,
         c.name            AS cat_name,
         c.slug            AS cat_slug,
         c.price_per_hour  AS cat_price,
         c.bg_color        AS cat_bg,
         c.border_color    AS cat_border,
         c.icon_path       AS cat_icon_path,
         c.icon_color      AS cat_icon_color,
         s.sort_order
       FROM services s
       LEFT JOIN categories c ON c.id = s.category_id AND c.deleted_at IS NULL
       WHERE s.is_active = 1
         AND s.deleted_at IS NULL
         AND (s.category_id IS NULL OR c.is_active = 1)
       ORDER BY s.sort_order ASC`
    );

    return NextResponse.json({
      success: true,
      services: services.map((s) => {
        // Construct full URL for icon if path exists
        let iconUrl = null;
        if (s.cat_icon_path) {
          // If path already starts with http/https, use as-is
          if (s.cat_icon_path.startsWith('http://') || s.cat_icon_path.startsWith('https://')) {
            iconUrl = s.cat_icon_path;
          } else {
            // Otherwise, construct full URL using base URL from environment
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
            iconUrl = `${baseUrl}${s.cat_icon_path.startsWith('/') ? '' : '/'}${s.cat_icon_path}`;
          }
        }

        return {
          id:             s.id,
          name:           s.cat_name   ?? s.svc_name,
          slug:           s.cat_slug   ?? s.svc_slug,
          price_per_hour: parseFloat(s.cat_price ?? s.svc_price),
          bg_color:       s.cat_bg     ?? s.svc_bg,
          border_color:   s.cat_border ?? s.svc_border,
          icon_path:      iconUrl,
          icon_color:     s.cat_icon_color ?? s.cat_border ?? s.svc_border,
        };
      }),
    });
  } catch (err) {
    console.error('customer services error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
