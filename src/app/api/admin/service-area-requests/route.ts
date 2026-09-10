import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';

// ── INTERFACES ────────────────────────────────────────────────────────────────
interface AreaRequest {
  id: number;
  category_id: number;
  category_name: string;
  latitude: number;
  longitude: number;
  city: string | null;
  request_count: number;
  last_requested_at: string;
  customer_name: string | null;
  customer_phone: string | null;
}

// ── GET /api/admin/service-area-requests ──────────────────────────────────────
// List all service area requests with grouping options
export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, 'service-areas.manage');
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const groupBy = searchParams.get('groupBy') || 'location'; // 'location' | 'category'
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '100')));

    let requests: AreaRequest[];

    if (groupBy === 'category') {
      // Group by category - show total requests per service type
      requests = await query<AreaRequest[]>(
        `SELECT 
          MIN(r.id) as id,
          c.id as category_id,
          c.name as category_name,
          ROUND(AVG(r.latitude), 4) as latitude,
          ROUND(AVG(r.longitude), 4) as longitude,
          r.city,
          COUNT(*) as request_count,
          MAX(r.requested_at) as last_requested_at,
          NULL as customer_name,
          NULL as customer_phone
        FROM service_area_requests r
        INNER JOIN categories c ON r.category_id = c.id
        GROUP BY c.id, r.city
        ORDER BY request_count DESC, last_requested_at DESC
        LIMIT ?`,
        [limit]
      );
    } else {
      // Group by location - show requests from similar locations (rounded to ~100m precision)
      requests = await query<AreaRequest[]>(
        `SELECT 
          MIN(r.id) as id,
          c.id as category_id,
          c.name as category_name,
          ROUND(r.latitude, 3) as latitude,
          ROUND(r.longitude, 3) as longitude,
          r.city,
          COUNT(*) as request_count,
          MAX(r.requested_at) as last_requested_at,
          cu.name as customer_name,
          cu.phone as customer_phone
        FROM service_area_requests r
        INNER JOIN categories c ON r.category_id = c.id
        LEFT JOIN customers cu ON r.customer_id = cu.id
        GROUP BY ROUND(r.latitude, 3), ROUND(r.longitude, 3), c.id, r.city
        ORDER BY request_count DESC, last_requested_at DESC
        LIMIT ?`,
        [limit]
      );
    }

    // Get total count
    const totalResult = await query<{ total: number }[]>(
      `SELECT COUNT(DISTINCT 
        CASE 
          WHEN ? = 'category' THEN CONCAT(category_id, '-', COALESCE(city, 'unknown'))
          ELSE CONCAT(ROUND(latitude, 3), '-', ROUND(longitude, 3), '-', category_id)
        END
      ) as total
      FROM service_area_requests`,
      [groupBy]
    );
    const total = totalResult[0]?.total || 0;

    return NextResponse.json({
      requests,
      total,
      groupBy
    });

  } catch (err) {
    console.error('[admin/service-area-requests GET] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch service area requests' },
      { status: 500 }
    );
  }
}
