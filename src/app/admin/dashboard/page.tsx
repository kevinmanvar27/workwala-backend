'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Shield, FileText, Trash2, Plus, ArrowUpRight, TrendingUp } from 'lucide-react';
import PermissionGuard from '@/components/admin/PermissionGuard';

interface DashboardData {
  stats: {
    totalUsers: number; activeUsers: number; totalRoles: number;
    totalPages: number; publishedPages: number; pendingDeleteRequests: number;
  };
  recentUsers: {
    id: number; name: string; email: string; role_name: string; status: string; created_at: string;
  }[];
}

const STATUS: Record<string, { dot: string; text: string; bg: string }> = {
  active:   { dot: 'bg-[#2E7D32]', text: 'text-[#2E7D32]', bg: 'bg-green-50' },
  inactive: { dot: 'bg-[#757575]', text: 'text-[#757575]', bg: 'bg-[#F9F9F9]' },
  banned:   { dot: 'bg-red-500',   text: 'text-red-700',   bg: 'bg-red-50' },
};

function DashboardContent() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);

  const can = (slug: string) => permissions.includes(slug);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()),
      fetch('/api/admin/dashboard').then((r) => r.json()),
    ])
      .then(([me, dash]) => {
        if (Array.isArray(me.permissions)) setPermissions(me.permissions);
        setData(dash);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const s = data?.stats;

  // Stat cards — use CSS vars so palette changes apply globally
  const ALL_STATS = [
    {
      label: 'Total Users',
      value: s?.totalUsers ?? 0,
      sub: `${s?.activeUsers ?? 0} active`,
      icon: <Users size={18} />,
      color: 'var(--primary)',
      href: '/admin/users',
      permission: 'users.view',
      trend: '+12%',
    },
    {
      label: 'Roles',
      value: s?.totalRoles ?? 0,
      sub: 'Configured roles',
      icon: <Shield size={18} />,
      color: 'var(--accent)',
      href: '/admin/roles',
      permission: 'roles.view',
      trend: null,
    },
    {
      label: 'Pages',
      value: s?.totalPages ?? 0,
      sub: `${s?.publishedPages ?? 0} published`,
      icon: <FileText size={18} />,
      color: 'var(--primary)',
      href: '/admin/pages',
      permission: 'pages.view',
      trend: null,
    },
    {
      label: 'Delete Requests',
      value: s?.pendingDeleteRequests ?? 0,
      sub: 'Pending review',
      icon: <Trash2 size={18} />,
      color: '#e53935',
      href: '/admin/users',
      permission: 'users.view',
      trend: null,
    },
  ];

  // Quick actions
  const ALL_ACTIONS = [
    { label: 'Add New User', href: '/admin/users/new',  icon: <Users size={15} />,    permission: 'users.create',  isPrimary: true },
    { label: 'Create Role',  href: '/admin/roles/new',  icon: <Shield size={15} />,   permission: 'roles.create',  isPrimary: false },
    { label: 'New Page',     href: '/admin/pages/new',  icon: <FileText size={15} />, permission: 'pages.create',  isPrimary: true },
  ];

  const visibleStats   = permissions.length === 0 ? ALL_STATS   : ALL_STATS.filter((s) => can(s.permission));
  const visibleActions = permissions.length === 0 ? ALL_ACTIONS : ALL_ACTIONS.filter((a) => can(a.permission));
  const canViewUsers   = permissions.length === 0 || can('users.view');

  return (
    <div className="p-6 lg:p-8 w-full">
      {/* Page title */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#2D2D2D] tracking-tight">Dashboard</h1>
        <p className="text-[#757575] text-sm mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#E0E0E0] p-5 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[var(--light-purple)] rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-6 bg-[var(--light-purple)] rounded w-12" />
                  <div className="h-3 bg-[var(--light-purple)] rounded w-20" />
                  <div className="h-2.5 bg-[var(--light-purple)] rounded w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : visibleStats.length > 0 ? (
        <div className={`grid gap-4 mb-8 ${
          visibleStats.length === 1 ? 'grid-cols-1 max-w-xs' :
          visibleStats.length === 2 ? 'grid-cols-2 max-w-md' :
          visibleStats.length === 3 ? 'grid-cols-2 lg:grid-cols-3' :
          'grid-cols-2 lg:grid-cols-4'
        }`}>
          {visibleStats.map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="bg-white rounded-2xl border border-[#E0E0E0] p-5 hover:border-[#bdbdbd] hover:shadow-md transition-all group flex items-center gap-6"
            >
              {/* Left — icon box */}
              <div
                className="w-12 h-12 text-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform"
                style={{ backgroundColor: stat.color, boxShadow: `0 4px 14px color-mix(in srgb, ${stat.color} 30%, transparent)` }}
              >
                {stat.icon}
              </div>

              {/* Right — all data */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-[#2D2D2D] tabular-nums leading-none">{stat.value}</p>
                  {stat.trend && (
                    <span className="flex items-center gap-0.5 text-[10px] font-semibold text-[#2E7D32] bg-green-50 px-1.5 py-0.5 rounded-full">
                      <TrendingUp size={9} />
                      {stat.trend}
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-[#2D2D2D] mt-1 truncate">{stat.label}</p>
                <p className="text-[11px] text-[#bdbdbd] mt-0.5 truncate">{stat.sub}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : null}

      {/* ── Bottom section ──────────────────────────────────────── */}
      <div className={`grid grid-cols-1 gap-6 ${(canViewUsers || visibleActions.length > 0) ? 'lg:grid-cols-3' : ''}`}>

        {/* Recent Users */}
        {canViewUsers && (
          <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E0E0E0] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E0E0E0] flex items-center justify-between">
              <h2 className="font-semibold text-[#2D2D2D] text-sm">Recent Users</h2>
              <Link
                href="/admin/users"
                className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
                style={{ color: 'var(--primary)' }}
              >
                View all <ArrowUpRight size={12} />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#F9F9F9]">
                    <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3">User</th>
                    <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3 hidden sm:table-cell">Role</th>
                    <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="border-b border-[#F9F9F9]">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[var(--light-purple)] animate-pulse flex-shrink-0" />
                            <div className="space-y-1.5">
                              <div className="h-3 bg-[var(--light-purple)] rounded w-28 animate-pulse" />
                              <div className="h-2.5 bg-[var(--light-purple)] rounded w-36 animate-pulse" />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 hidden sm:table-cell"><div className="h-3 bg-[var(--light-purple)] rounded w-16 animate-pulse" /></td>
                        <td className="px-6 py-3.5"><div className="h-5 bg-[var(--light-purple)] rounded-full w-14 animate-pulse" /></td>
                      </tr>
                    ))
                  ) : data?.recentUsers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-[#757575] text-sm">No users yet</td>
                    </tr>
                  ) : (
                    data?.recentUsers.map((user) => {
                      const st = STATUS[user.status] || STATUS.inactive;
                      return (
                        <tr key={user.id} className="border-b border-[#F9F9F9] last:border-0 hover:bg-[#F9F9F9]/50 transition-colors">
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-3">
                              {/* Avatar — brand gradient via CSS vars */}
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}
                              >
                                {user.name[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-[#2D2D2D] leading-none">{user.name}</p>
                                <p className="text-xs text-[#757575] mt-0.5">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-3.5 hidden sm:table-cell">
                            <span className="text-xs text-[#757575]">{user.role_name || '—'}</span>
                          </td>
                          <td className="px-6 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                              {user.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Right column — Quick Actions + System info */}
        <div className={`space-y-4 ${!canViewUsers ? 'lg:col-span-3' : ''}`}>

          {/* Quick Actions */}
          {visibleActions.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E0E0E0] p-5">
              <h2 className="font-semibold text-[#2D2D2D] text-sm mb-4">Quick Actions</h2>
              <div className="space-y-2">
                {visibleActions.map((a) => (
                  <Link
                    key={a.label}
                    href={a.href}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-90"
                    style={{
                      backgroundColor: a.isPrimary ? 'var(--light-purple)' : 'color-mix(in srgb, var(--accent) 12%, white)',
                      color: a.isPrimary ? 'var(--primary)' : 'var(--accent)',
                    }}
                  >
                    <span className="flex-shrink-0">{a.icon}</span>
                    {a.label}
                    <Plus size={14} className="ml-auto opacity-60" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* System info — brand gradient via CSS vars */}
          <div
            className="rounded-2xl p-5 text-white"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}
          >
            <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">System</p>
            <div className="space-y-2">
              {[
                { label: 'Version',   value: '1.0.0' },
                { label: 'Framework', value: 'Next.js 16' },
                { label: 'Database',  value: 'MySQL' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-xs text-white/60">{item.label}</span>
                  <span className="text-xs font-semibold text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <PermissionGuard permission="dashboard.view">
      <DashboardContent />
    </PermissionGuard>
  );
}
