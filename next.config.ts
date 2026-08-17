import type { NextConfig } from "next";

// ── Static security headers applied to every response ─────────────────────────
// NOTE: Content-Security-Policy is intentionally NOT set here.
// It is injected per-request by middleware.ts with a unique nonce, which
// eliminates the 'unsafe-inline' weakness. Setting a static CSP here would
// override the nonce-based one from middleware.
const securityHeaders = [
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },

  // Clickjacking protection
  { key: 'X-Frame-Options', value: 'DENY' },

  // Stop sending the full URL as Referer to third-party sites
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

  // Disable browser features the app does not use
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), payment=(), usb=()' },

  // Force HTTPS for 1 year (production only — safe to set in all envs)
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
