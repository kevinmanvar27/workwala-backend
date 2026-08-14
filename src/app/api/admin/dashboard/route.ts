import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, 'dashboard.view');
  if (error) return error;

  try {
    const [userCount] = await query<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL`
    );
    const [activeUsers] = await query<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL AND status = 'active'`
    );
    const [roleCount] = await query<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM roles WHERE deleted_at IS NULL`
    );
    const [pageCount] = await query<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM pages WHERE deleted_at IS NULL`
    );
    const [publishedPages] = await query<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM pages WHERE deleted_at IS NULL AND status = 'published'`
    );
    const [pendingDeletes] = await query<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM delete_account_requests WHERE status = 'pending' AND deleted_at IS NULL`
    );

    const recentUsers = await query<{ id: number; name: string; email: string; role_name: string; status: string; created_at: string }[]>(
      `SELECT u.id, u.name, u.email, r.name as role_name, u.status, u.created_at
       FROM users u LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.deleted_at IS NULL ORDER BY u.created_at DESC LIMIT 5`
    );

    return NextResponse.json({
      stats: {
        totalUsers: userCount.count,
        activeUsers: activeUsers.count,
        totalRoles: roleCount.count,
        totalPages: pageCount.count,
        publishedPages: publishedPages.count,
        pendingDeleteRequests: pendingDeletes.count,
      },
      recentUsers,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
