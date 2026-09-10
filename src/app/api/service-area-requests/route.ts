import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCustomerFromToken } from '@/lib/customerAuth';

// ── RATE LIMITING ─────────────────────────────────────────────────────────────
// Simple in-memory rate limiter to prevent spam
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per IP

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // Clean up expired entries
  if (rateLimitStore.size > 5000) {
    for (const [key, val] of rateLimitStore.entries()) {
      if (val.resetAt < now) rateLimitStore.delete(key);
    }
  }

  if (!entry || entry.resetAt < now) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateLimitStore.set(identifier, { count: 1, resetAt });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count };
}

// ── POST /api/service-area-requests ───────────────────────────────────────────
// Public endpoint to track when customers request services in unavailable areas
export async function POST(req: NextRequest) {
  try {
    // Rate limiting by IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
               req.headers.get('x-real-ip') || 
               'unknown';
    
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { category_id, latitude, longitude, device_info, city, address } = body;

    // Validate required fields
    if (!category_id || typeof category_id !== 'number') {
      return NextResponse.json(
        { error: 'category_id is required and must be a number' },
        { status: 400 }
      );
    }

    if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
      return NextResponse.json(
        { error: 'Invalid latitude. Must be between -90 and 90' },
        { status: 400 }
      );
    }

    if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
      return NextResponse.json(
        { error: 'Invalid longitude. Must be between -180 and 180' },
        { status: 400 }
      );
    }

    // Get customer ID if logged in (optional - user might not be logged in)
    let customerId: number | null = null;
    try {
      const { customer } = await getCustomerFromToken(req);
      customerId = customer?.id || null;
    } catch (err) {
      // Not logged in - that's okay, we'll store NULL
      customerId = null;
    }

    // Insert the request into database
    await query(
      `INSERT INTO service_area_requests 
       (customer_id, category_id, latitude, longitude, city, address, device_info, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId,
        category_id,
        latitude,
        longitude,
        city || null,
        address || null,
        device_info ? JSON.stringify(device_info) : null,
        ip
      ]
    );

    return NextResponse.json(
      { 
        success: true,
        message: 'Request tracked successfully'
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('[service-area-requests POST] Error:', error);
    
    // Don't expose internal errors to clients
    return NextResponse.json(
      { error: 'Failed to track request' },
      { status: 500 }
    );
  }
}
