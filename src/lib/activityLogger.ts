import { query } from './db';
import type { NextRequest } from 'next/server';

/**
 * Extracts the real client IP from a Next.js request.
 * Checks headers in priority order, then falls back to request.ip.
 * Works in local dev (XAMPP), behind nginx, and behind Cloudflare/proxies.
 */
/** Normalize loopback addresses to a consistent IPv4 form */
function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  // IPv6 loopback → IPv4 loopback
  if (trimmed === '::1' || trimmed === '::ffff:127.0.0.1') return '127.0.0.1';
  // Strip IPv6-mapped IPv4 prefix (e.g. ::ffff:192.168.1.1 → 192.168.1.1)
  if (trimmed.startsWith('::ffff:')) return trimmed.slice(7);
  return trimmed;
}

export function getClientIp(req: NextRequest): string | null {
  // 1. Cloudflare real IP
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return normalizeIp(cfIp);

  // 2. Standard proxy forwarded header (may be comma-separated list — take first)
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0];
    if (first.trim()) return normalizeIp(first);
  }

  // 3. nginx / load balancer real IP
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return normalizeIp(realIp);

  // 4. Other common proxy headers
  const clientIp = req.headers.get('x-client-ip');
  if (clientIp) return normalizeIp(clientIp);

  const forwardedHeader = req.headers.get('forwarded');
  if (forwardedHeader) {
    const match = forwardedHeader.match(/for=["[]?([^\]",;]+)/i);
    if (match?.[1]) return normalizeIp(match[1]);
  }

  // 5. Next.js built-in request.ip (works in local dev without any proxy)
  const reqWithIp = req as NextRequest & { ip?: string };
  if (reqWithIp.ip) return normalizeIp(reqWithIp.ip);

  return null;
}

/**
 * Logs an admin action to the activity_logs table.
 * Fire-and-forget — never throws so it never breaks the calling route.
 */
export async function logActivity(opts: {
  userId: number | null;
  userName: string;
  action: string;       // e.g. 'Created', 'Updated', 'Deleted', 'Restored', 'Login', 'Logout'
  module: string;       // e.g. 'users', 'roles', 'pages', 'settings', 'auth'
  targetId?: number | null;
  targetName?: string;  // human-readable label of the affected record
  description?: string; // optional extra detail
  ipAddress?: string | null;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO activity_logs
         (user_id, user_name, action, module, target_id, target_name, description, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        opts.userId ?? null,
        opts.userName,
        opts.action,
        opts.module,
        opts.targetId ?? null,
        opts.targetName ?? null,
        opts.description ?? null,
        opts.ipAddress ?? null,
      ]
    );
  } catch {
    // Silently swallow — logging must never break main functionality
  }
}
