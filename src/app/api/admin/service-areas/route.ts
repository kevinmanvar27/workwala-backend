import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';

// ── INTERFACES ────────────────────────────────────────────────────────────────
interface ServiceArea {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  status: 'active' | 'disabled';
  city: string | null;
  created_at: string;
  updated_at: string;
}

interface CountResult {
  total: number;
}

// ── GET /api/admin/service-areas ──────────────────────────────────────────────
// List service areas with pagination and filtering
export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, 'service-areas.manage');
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    
    // Pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    // Filters
    const statusFilter = searchParams.get('status'); // 'active' | 'disabled' | null
    const cityFilter = searchParams.get('city');
    const searchQuery = searchParams.get('search');

    // Build WHERE clause
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (statusFilter && ['active', 'disabled'].includes(statusFilter)) {
      conditions.push('status = ?');
      params.push(statusFilter);
    }

    if (cityFilter) {
      conditions.push('city = ?');
      params.push(cityFilter);
    }

    if (searchQuery) {
      conditions.push('(name LIKE ? OR city LIKE ?)');
      params.push(`%${searchQuery}%`, `%${searchQuery}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await query<CountResult[]>(
      `SELECT COUNT(*) as total FROM service_areas ${whereClause}`,
      params
    );
    const total = countResult[0]?.total || 0;

    // Get paginated results
    const areas = await query<ServiceArea[]>(
      `SELECT 
        id, name, latitude, longitude, radius_meters, status, city, 
        created_at, updated_at
      FROM service_areas
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Get unique cities for filter dropdown
    const cities = await query<{ city: string }[]>(
      `SELECT DISTINCT city FROM service_areas WHERE city IS NOT NULL ORDER BY city ASC`
    );

    return NextResponse.json({
      areas,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      filters: {
        cities: cities.map(c => c.city)
      }
    });

  } catch (err) {
    console.error('[admin/service-areas GET] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch service areas' },
      { status: 500 }
    );
  }
}

// ── POST /api/admin/service-areas ─────────────────────────────────────────────
// Create a new service area
export async function POST(req: NextRequest) {
  const { error, user } = await requirePermission(req, 'service-areas.manage');
  if (error) return error;

  try {
    const body = await req.json();
    const { name, latitude, longitude, radiusMeters, city, status } = body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
      return NextResponse.json(
        { error: 'Latitude must be a number between -90 and 90' },
        { status: 400 }
      );
    }

    if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
      return NextResponse.json(
        { error: 'Longitude must be a number between -180 and 180' },
        { status: 400 }
      );
    }

    if (typeof radiusMeters !== 'number' || radiusMeters <= 0) {
      return NextResponse.json(
        { error: 'Radius must be a positive number (in meters)' },
        { status: 400 }
      );
    }

    if (status && !['active', 'disabled'].includes(status)) {
      return NextResponse.json(
        { error: 'Status must be either "active" or "disabled"' },
        { status: 400 }
      );
    }

    // Insert service area
    const result = await query<{ insertId: number }>(
      `INSERT INTO service_areas (name, latitude, longitude, radius_meters, city, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        latitude,
        longitude,
        Math.round(radiusMeters),
        city?.trim() || null,
        status || 'active'
      ]
    );

    // Fetch the created area
    const created = await query<ServiceArea[]>(
      `SELECT * FROM service_areas WHERE id = ?`,
      [(result as any).insertId]
    );

    // Log activity
    await query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'create', 'service_area', ?, ?)`,
      [user?.userId, (result as any).insertId, JSON.stringify({ name: name.trim(), city: city?.trim() })]
    ).catch(() => {}); // Non-critical

    return NextResponse.json(
      { 
        message: 'Service area created successfully',
        area: created[0]
      },
      { status: 201 }
    );

  } catch (err) {
    console.error('[admin/service-areas POST] Error:', err);
    return NextResponse.json(
      { error: 'Failed to create service area' },
      { status: 500 }
    );
  }
}
