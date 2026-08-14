import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';

export interface SearchResult {
  id: string;
  type: 'user' | 'role' | 'page' | 'nav';
  title: string;
  subtitle: string;
  href: string;
}

// Static nav items always included (filtered by query)
const NAV_ITEMS: SearchResult[] = [
  { id: 'nav-dashboard',     type: 'nav', title: 'Dashboard',     subtitle: 'Overview & stats',          href: '/admin/dashboard' },
  { id: 'nav-analytics',     type: 'nav', title: 'Analytics',     subtitle: 'Charts & metrics',          href: '/admin/analytics' },
  { id: 'nav-users',         type: 'nav', title: 'Users',         subtitle: 'Manage users',              href: '/admin/users' },
  { id: 'nav-roles',         type: 'nav', title: 'Roles',         subtitle: 'Manage roles',              href: '/admin/roles' },
  { id: 'nav-permissions',   type: 'nav', title: 'Permissions',   subtitle: 'View permissions',          href: '/admin/permissions' },
  { id: 'nav-pages',         type: 'nav', title: 'Pages',         subtitle: 'Manage public pages',       href: '/admin/pages' },
  { id: 'nav-activity-logs', type: 'nav', title: 'Activity Logs', subtitle: 'Audit trail',               href: '/admin/activity-logs' },
  { id: 'nav-settings',      type: 'nav', title: 'Settings',      subtitle: 'General configuration',    href: '/admin/settings' },
  { id: 'nav-settings-auth', type: 'nav', title: 'Auth Settings', subtitle: 'Login & OAuth',             href: '/admin/settings?tab=auth' },
  { id: 'nav-settings-mail', type: 'nav', title: 'Mail Settings', subtitle: 'SMTP configuration',       href: '/admin/settings?tab=mail' },
  { id: 'nav-settings-pay',  type: 'nav', title: 'Payment Settings', subtitle: 'Razorpay credentials',  href: '/admin/settings?tab=payment' },
  { id: 'nav-settings-app',  type: 'nav', title: 'Appearance',    subtitle: 'Brand colors & palette',   href: '/admin/settings?tab=appearance' },
];

export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, 'dashboard.view');
  if (error) return error;

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().toLowerCase();

  // Empty query — return just nav items
  if (!q) {
    return NextResponse.json({ results: NAV_ITEMS.slice(0, 8) });
  }

  const results: SearchResult[] = [];

  // 1. Nav items (instant, no DB)
  const matchedNav = NAV_ITEMS.filter(
    (n) => n.title.toLowerCase().includes(q) || n.subtitle.toLowerCase().includes(q)
  );
  results.push(...matchedNav);

  // 2. Users
  try {
    const users = await query<{ id: number; name: string; email: string; role_name: string }[]>(
      `SELECT u.id, u.name, u.email, COALESCE(r.name, 'No Role') AS role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.deleted_at IS NULL
         AND (u.name LIKE ? OR u.email LIKE ?)
       LIMIT 5`,
      [`%${q}%`, `%${q}%`]
    );
    for (const u of users) {
      results.push({
        id: `user-${u.id}`,
        type: 'user',
        title: u.name,
        subtitle: `${u.email} · ${u.role_name}`,
        href: `/admin/users`,
      });
    }
  } catch { /* ignore DB errors gracefully */ }

  // 3. Roles
  try {
    const roles = await query<{ id: number; name: string; description: string }[]>(
      `SELECT id, name, COALESCE(description, '') AS description
       FROM roles
       WHERE deleted_at IS NULL AND name LIKE ?
       LIMIT 4`,
      [`%${q}%`]
    );
    for (const r of roles) {
      results.push({
        id: `role-${r.id}`,
        type: 'role',
        title: r.name,
        subtitle: r.description || 'Role',
        href: `/admin/roles`,
      });
    }
  } catch { /* ignore */ }

  // 4. Pages
  try {
    const pages = await query<{ id: number; title: string; slug: string; status: string }[]>(
      `SELECT id, title, slug, status
       FROM pages
       WHERE deleted_at IS NULL AND (title LIKE ? OR slug LIKE ?)
       LIMIT 4`,
      [`%${q}%`, `%${q}%`]
    );
    for (const p of pages) {
      results.push({
        id: `page-${p.id}`,
        type: 'page',
        title: p.title,
        subtitle: `/${p.slug} · ${p.status}`,
        href: `/admin/pages`,
      });
    }
  } catch { /* ignore */ }

  return NextResponse.json({ results: results.slice(0, 12) });
}
