import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';


const PUBLIC_PATHS = [
  '/login',
  '/pages',
  '/delete-account',
  '/api/auth',
  '/api/public',
  '/_next',
  '/favicon.ico',
  // NOTE: /uploads is intentionally NOT public — files are served via /api/files
];

// Must use jose (Edge-compatible) — jsonwebtoken uses Node.js crypto
// which is NOT available in the Edge Runtime where middleware runs.
async function verifyEdgeToken(token: string): Promise<boolean> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('[middleware] JWT_SECRET is not set');
    return false;
  }
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return applyNonce(NextResponse.next(), request);
  }

  // Allow root page (public landing)
  if (pathname === '/') {
    return applyNonce(NextResponse.next(), request);
  }

  // Protect /admin routes
  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const valid = await verifyEdgeToken(token);
    if (!valid) {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('auth_token');
      return response;
    }

    return applyNonce(NextResponse.next(), request);
  }

  return applyNonce(NextResponse.next(), request);
}

/**
 * Generates a per-request CSP nonce and injects it into both:
 *   1. A request header (x-nonce) so layout.tsx can read it server-side.
 *   2. The Content-Security-Policy response header — replaces 'unsafe-inline'.
 *
 * This eliminates the 'unsafe-inline' script-src weakness while still
 * allowing the GA snippet and Next.js inline scripts to execute.
 */
function applyNonce(response: NextResponse, request: NextRequest): NextResponse {
  const nonce = Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(16))).toString('base64');

  // Pass nonce to the RSC layer via a request header
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const isDev = process.env.NODE_ENV === 'development';

  const csp = [
    "default-src 'self'",
    // nonce allows specific inline scripts; 'strict-dynamic' propagates trust to loaded scripts
    // 'unsafe-eval' is required in dev mode for React's source-map reconstruction and hot reload
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''} https://www.googletagmanager.com https://www.google-analytics.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://www.google-analytics.com https://maps.googleapis.com https://nominatim.openstreetmap.org",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('x-nonce', nonce); // available to layout.tsx via headers()
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
