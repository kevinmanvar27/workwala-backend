import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/public/landing-stats
// No auth required — returns aggregated public-safe stats for the landing page.
export async function GET() {
  try {
    function n(row: { count: unknown } | undefined): number {
      return Number(row?.count ?? 0);
    }

    const [totalCustomers]   = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM customers WHERE deleted_at IS NULL`);
    const [approvedPartners] = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM partners WHERE deleted_at IS NULL AND status = 'approved'`);
    const [completedBookings]= await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM bookings WHERE deleted_at IS NULL AND status = 'completed'`);
    const [totalCategories]  = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM categories WHERE deleted_at IS NULL AND is_active = 1`);

    // Active service categories for the "services" section
    const categories = await query<{
      id: number;
      name: string;
      slug: string;
      description: string | null;
      price_per_hour: string;
      bg_color: string;
      border_color: string;
      icon_path: string | null;
      icon_color: string | null;
    }[]>(
      `SELECT id, name, slug, description, price_per_hour, bg_color, border_color, icon_path, icon_color
       FROM categories
       WHERE is_active = 1 AND deleted_at IS NULL
       ORDER BY sort_order ASC, id ASC
       LIMIT 8`
    );

    return NextResponse.json({
      stats: {
        totalCustomers:   n(totalCustomers),
        approvedPartners: n(approvedPartners),
        completedBookings:n(completedBookings),
        totalCategories:  n(totalCategories),
      },
      categories: categories.map((c) => ({
        id:            c.id,
        name:          c.name,
        slug:          c.slug,
        description:   c.description ?? '',
        pricePerHour:  parseFloat(c.price_per_hour),
        bgColor:       c.bg_color   || '#F0F5FF',
        borderColor:   c.border_color || '#6B9BFA',
        iconPath:      c.icon_path ?? null,
        iconColor:     c.icon_color ?? c.border_color ?? '#6B9BFA',
      })),
    });
  } catch (err) {
    console.error('landing-stats error:', err);
    // Return graceful zeros — never break the landing page
    return NextResponse.json({
      stats: { totalCustomers: 0, approvedPartners: 0, completedBookings: 0, totalCategories: 0 },
      categories: [],
    });
  }
}
