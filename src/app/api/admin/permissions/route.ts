import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, 'permissions.view');
  if (error) return error;

  try {
    const permissions = await query<{
      id: number; name: string; slug: string; module: string; description: string; created_at: string;
    }[]>(
      `SELECT id, name, slug, module, description, created_at
       FROM permissions WHERE deleted_at IS NULL ORDER BY module, name`
    );

    // Group by module
    const grouped: Record<string, typeof permissions> = {};
    for (const perm of permissions) {
      if (!grouped[perm.module]) grouped[perm.module] = [];
      grouped[perm.module].push(perm);
    }

    return NextResponse.json({ permissions, grouped });
  } catch (err) {
    console.error('Permissions GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
