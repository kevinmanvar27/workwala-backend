import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';

// MySQL COUNT(*) returns a BigInt via mysql2 — always cast with Number()
function n(row: { count: unknown }): number {
  return Number(row?.count ?? 0);
}

export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, 'dashboard.view');
  if (error) return error;

  try {
    // ── Summary counts ──────────────────────────────────────────
    const [totalUsers]       = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL`);
    const [activeUsers]      = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL AND status = 'active'`);
    const [inactiveUsers]    = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL AND status = 'inactive'`);
    const [bannedUsers]      = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL AND status = 'banned'`);
    const [totalPages]       = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM pages WHERE deleted_at IS NULL`);
    const [publishedPages]   = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM pages WHERE deleted_at IS NULL AND status = 'published'`);
    const [draftPages]       = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM pages WHERE deleted_at IS NULL AND status = 'draft'`);
    const [totalRoles]       = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM roles WHERE deleted_at IS NULL`);
    const [totalPermissions] = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM permissions WHERE deleted_at IS NULL`);
    const [totalLogs]        = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM activity_logs WHERE deleted_at IS NULL`);
    const [logsToday]        = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM activity_logs WHERE deleted_at IS NULL AND DATE(created_at) = CURDATE()`);
    const [pendingDeletes]   = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM delete_account_requests WHERE status = 'pending' AND deleted_at IS NULL`);

    // ── Users registered per day (last 30 days) ─────────────────
    const userGrowth = await query<{ day: string; count: unknown }[]>(`
      SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as day, COUNT(*) as count
      FROM users
      WHERE deleted_at IS NULL
        AND created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
      GROUP BY day
      ORDER BY day ASC
    `);

    // ── Activity logs per day (last 30 days) ────────────────────
    const activityGrowth = await query<{ day: string; count: unknown }[]>(`
      SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as day, COUNT(*) as count
      FROM activity_logs
      WHERE deleted_at IS NULL
        AND created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
      GROUP BY day
      ORDER BY day ASC
    `);

    // ── Activity by module ──────────────────────────────────────
    const activityByModule = await query<{ module: string; count: unknown }[]>(`
      SELECT module, COUNT(*) as count
      FROM activity_logs
      WHERE deleted_at IS NULL
      GROUP BY module
      ORDER BY count DESC
    `);

    // ── Activity by action ──────────────────────────────────────
    const activityByAction = await query<{ action: string; count: unknown }[]>(`
      SELECT action, COUNT(*) as count
      FROM activity_logs
      WHERE deleted_at IS NULL
      GROUP BY action
      ORDER BY count DESC
    `);

    // ── User status breakdown ────────────────────────────────────
    const usersByStatus = await query<{ status: string; count: unknown }[]>(`
      SELECT status, COUNT(*) as count
      FROM users
      WHERE deleted_at IS NULL
      GROUP BY status
    `);

    // ── Pages status breakdown ───────────────────────────────────
    const pagesByStatus = await query<{ status: string; count: unknown }[]>(`
      SELECT status, COUNT(*) as count
      FROM pages
      WHERE deleted_at IS NULL
      GROUP BY status
    `);

    // ── Permissions per module ───────────────────────────────────
    const permissionsByModule = await query<{ module: string; count: unknown }[]>(`
      SELECT module, COUNT(*) as count
      FROM permissions
      WHERE deleted_at IS NULL
      GROUP BY module
      ORDER BY count DESC
    `);

    // ── Top 5 most active users (by log count) ───────────────────
    const topActiveUsers = await query<{ user_name: string; count: unknown }[]>(`
      SELECT user_name, COUNT(*) as count
      FROM activity_logs
      WHERE deleted_at IS NULL AND user_name != ''
      GROUP BY user_name
      ORDER BY count DESC
      LIMIT 5
    `);

    // ── Recent activity (last 10 logs) ───────────────────────────
    const recentActivity = await query<{
      id: number; user_name: string; action: string;
      module: string; target_name: string | null;
      description: string | null; created_at: string;
    }[]>(`
      SELECT id, user_name, action, module, target_name, description, created_at
      FROM activity_logs
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 10
    `);

    // ── Users registered this month vs last month ────────────────
    const [usersThisMonth] = await query<{ count: unknown }[]>(`
      SELECT COUNT(*) as count FROM users
      WHERE deleted_at IS NULL
        AND YEAR(created_at) = YEAR(CURDATE())
        AND MONTH(created_at) = MONTH(CURDATE())
    `);
    const [usersLastMonth] = await query<{ count: unknown }[]>(`
      SELECT COUNT(*) as count FROM users
      WHERE deleted_at IS NULL
        AND YEAR(created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
        AND MONTH(created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
    `);

    // ── Activity logs this week vs last week (7-day windows) ─────
    const [logsThisWeek] = await query<{ count: unknown }[]>(`
      SELECT COUNT(*) as count FROM activity_logs
      WHERE deleted_at IS NULL
        AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    `);
    const [logsLastWeek] = await query<{ count: unknown }[]>(`
      SELECT COUNT(*) as count FROM activity_logs
      WHERE deleted_at IS NULL
        AND created_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
        AND created_at <  DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    `);

    // ── New users this week vs last week ─────────────────────────
    const [usersThisWeek] = await query<{ count: unknown }[]>(`
      SELECT COUNT(*) as count FROM users
      WHERE deleted_at IS NULL
        AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    `);
    const [usersLastWeek] = await query<{ count: unknown }[]>(`
      SELECT COUNT(*) as count FROM users
      WHERE deleted_at IS NULL
        AND created_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
        AND created_at <  DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    `);

    return NextResponse.json({
      summary: {
        totalUsers:        n(totalUsers),
        activeUsers:       n(activeUsers),
        inactiveUsers:     n(inactiveUsers),
        bannedUsers:       n(bannedUsers),
        totalPages:        n(totalPages),
        publishedPages:    n(publishedPages),
        draftPages:        n(draftPages),
        totalRoles:        n(totalRoles),
        totalPermissions:  n(totalPermissions),
        totalLogs:         n(totalLogs),
        logsToday:         n(logsToday),
        pendingDeletes:    n(pendingDeletes),
        usersThisMonth:    n(usersThisMonth),
        usersLastMonth:    n(usersLastMonth),
        logsThisWeek:      n(logsThisWeek),
        logsLastWeek:      n(logsLastWeek),
        usersThisWeek:     n(usersThisWeek),
        usersLastWeek:     n(usersLastWeek),
      },
      // Normalise count to number in all array results
      userGrowth:         userGrowth.map((r)         => ({ day: r.day,       count: Number(r.count) })),
      activityGrowth:     activityGrowth.map((r)     => ({ day: r.day,       count: Number(r.count) })),
      activityByModule:   activityByModule.map((r)   => ({ module: r.module, count: Number(r.count) })),
      activityByAction:   activityByAction.map((r)   => ({ action: r.action, count: Number(r.count) })),
      usersByStatus:      usersByStatus.map((r)       => ({ status: r.status, count: Number(r.count) })),
      pagesByStatus:      pagesByStatus.map((r)       => ({ status: r.status, count: Number(r.count) })),
      permissionsByModule:permissionsByModule.map((r) => ({ module: r.module, count: Number(r.count) })),
      topActiveUsers:     topActiveUsers.map((r)      => ({ user_name: r.user_name, count: Number(r.count) })),
      recentActivity,
    });
  } catch (err) {
    console.error('Analytics GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
