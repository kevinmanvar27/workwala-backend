import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/customer/services
// Public — returns all active services.
// When a service is linked to a category, ALL display fields (name, slug,
// price_per_hour, bg_color, border_color) come from the category so that
// admin edits are reflected immediately. Falls back to service-level values
// when no category is linked.
export async function GET() {
  try {
    const services = await query<{
      id: number;
      // service-level fallbacks
      svc_name: string;
      svc_slug: string;
      svc_price: string;
      svc_bg: string;
      svc_border: string;
      // category overrides (null when no category linked)
      cat_name: string | null;
      cat_slug: string | null;
      cat_price: string | null;
      cat_bg: string | null;
      cat_border: string | null;
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
      services: services.map((s) => ({
        id:            s.id,
        // category values take full priority over service values
        name:          s.cat_name        ?? s.svc_name,
        slug:          s.cat_slug        ?? s.svc_slug,
        price_per_hour: parseFloat(s.cat_price ?? s.svc_price),
        bg_color:      s.cat_bg          ?? s.svc_bg,
        border_color:  s.cat_border      ?? s.svc_border,
      })),
    });
  } catch (err) {
    console.error('customer services error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
