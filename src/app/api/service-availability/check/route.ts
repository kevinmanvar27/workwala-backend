import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// ── RATE LIMITING ─────────────────────────────────────────────────────────────
// Simple in-memory rate limiter (upgrade to Redis for production multi-instance)
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute per IP

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // Clean up expired entries periodically
  if (rateLimitStore.size > 10000) {
    for (const [key, val] of rateLimitStore.entries()) {
      if (val.resetAt < now) rateLimitStore.delete(key);
    }
  }

  if (!entry || entry.resetAt < now) {
    // New window
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateLimitStore.set(identifier, { count: 1, resetAt });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetAt };
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count, resetAt: entry.resetAt };
}

// ── VALIDATION ────────────────────────────────────────────────────────────────
function isValidLatitude(lat: number): boolean {
  return typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90;
}

function isValidLongitude(lng: number): boolean {
  return typeof lng === 'number' && !isNaN(lng) && lng >= -180 && lng <= 180;
}

// ── SERVICE AREA INTERFACE ────────────────────────────────────────────────────
interface ServiceArea {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  city: string | null;
  distance_meters: number;
}

// ── POST /api/service-availability/check ──────────────────────────────────────
// Public endpoint to check if a location is within any active service area.
// Optionally accepts category_id to check only areas assigned to that category.
// If category_id is omitted OR the category has no assigned areas → checks all areas.
export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
    const rateLimit = checkRateLimit(ip);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetAt.toString(),
            'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString()
          }
        }
      );
    }

    // Parse request body
    const body = await req.json();
    const { latitude, longitude, category_id } = body;

    // Validate coordinates
    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { 
          error: 'Missing required fields: latitude and longitude',
          code: 'MISSING_COORDINATES'
        },
        { status: 400 }
      );
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (!isValidLatitude(lat)) {
      return NextResponse.json(
        { 
          error: 'Invalid latitude. Must be between -90 and 90',
          code: 'INVALID_LATITUDE'
        },
        { status: 400 }
      );
    }

    if (!isValidLongitude(lng)) {
      return NextResponse.json(
        { 
          error: 'Invalid longitude. Must be between -180 and 180',
          code: 'INVALID_LONGITUDE'
        },
        { status: 400 }
      );
    }

    // ── Determine which service areas to check ─────────────────────────────
    // If category_id is provided, check only areas assigned to that category.
    // If the category has NO assigned areas → fall back to checking all areas
    // (this preserves backward compatibility for categories without restrictions).
    let areaFilter = ''; // extra JOIN/WHERE clause injected into the Haversine query

    if (category_id !== undefined && category_id !== null) {
      const catId = parseInt(String(category_id));
      if (!isNaN(catId) && catId > 0) {
        // Check how many areas are assigned to this category
        const assignedAreas = await query<{ service_area_id: number }[]>(
          `SELECT service_area_id FROM category_service_areas WHERE category_id = ?`,
          [catId]
        );

        if (assignedAreas.length > 0) {
          // Category has specific area restrictions — only check those areas
          const areaIds = assignedAreas.map((r) => r.service_area_id).join(',');
          areaFilter = `AND sa.id IN (${areaIds})`;
        }
        // If assignedAreas.length === 0 → no restriction → check all areas (areaFilter stays '')
      }
    }

    // ── Haversine query — find nearest matching active service area ─────────
    // Formula calculates great-circle distance between two points on Earth
    const areas = await query<ServiceArea[]>(
      `SELECT 
        sa.id,
        sa.name,
        sa.latitude,
        sa.longitude,
        sa.radius_meters,
        sa.city,
        (6371000 * acos(
          cos(radians(?)) * cos(radians(sa.latitude)) *
          cos(radians(sa.longitude) - radians(?)) +
          sin(radians(?)) * sin(radians(sa.latitude))
        )) AS distance_meters
      FROM service_areas sa
      WHERE sa.status = 'active'
      ${areaFilter}
      HAVING distance_meters <= sa.radius_meters
      ORDER BY distance_meters ASC
      LIMIT 1`,
      [lat, lng, lat]
    );

    // Add rate limit headers to response
    const headers = {
      'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
      'X-RateLimit-Remaining': rateLimit.remaining.toString(),
      'X-RateLimit-Reset': rateLimit.resetAt.toString()
    };

    // Check if location is covered
    if (areas.length > 0) {
      const area = areas[0];
      return NextResponse.json(
        {
          available: true,
          area: {
            id: area.id,
            name: area.name,
            radiusMeters: area.radius_meters,
            city: area.city,
            distanceMeters: Math.round(area.distance_meters)
          }
        },
        { headers }
      );
    }

    // No coverage found
    return NextResponse.json(
      {
        available: false,
        message: "We're not available at your location yet. We're coming soon!"
      },
      { headers }
    );

  } catch (error) {
    // Database or server error - return 503, NOT false availability
    console.error('[service-availability/check] Database error:', error);
    return NextResponse.json(
      {
        error: 'Service temporarily unavailable. Please try again.',
        code: 'SERVICE_UNAVAILABLE'
      },
      { status: 503 }
    );
  }
}
