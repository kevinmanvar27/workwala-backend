'use client';

import { useEffect, useState } from 'react';
import { Key, Lock, Search } from 'lucide-react';
import PermissionGuard from '@/components/admin/PermissionGuard';

interface Permission { id: number; name: string; slug: string; module: string; description?: string; }

const MODULE_COLORS: Record<string, { bg: string; icon: string; badge: string }> = {
  users:         { bg: 'bg-[var(--light-purple)]',  icon: 'text-[var(--primary)]',      badge: 'bg-[var(--light-purple)] text-[var(--primary)]' },
  roles:         { bg: 'bg-[color-mix(in_srgb,var(--accent)_12%,white)]', icon: 'text-[var(--accent)]', badge: 'bg-[color-mix(in_srgb,var(--accent)_12%,white)] text-[var(--accent)]' },
  permissions:   { bg: 'bg-[var(--light-purple)]',  icon: 'text-[var(--primary-dark)]', badge: 'bg-[var(--light-purple)] text-[var(--primary-dark)]' },
  pages:         { bg: 'bg-green-50',               icon: 'text-[#2E7D32]',             badge: 'bg-green-50 text-[#2E7D32]' },
  settings:      { bg: 'bg-amber-50',               icon: 'text-amber-600',             badge: 'bg-amber-100 text-amber-700' },
  activity_logs: { bg: 'bg-[color-mix(in_srgb,var(--accent)_12%,white)]', icon: 'text-[var(--accent)]', badge: 'bg-[color-mix(in_srgb,var(--accent)_12%,white)] text-[var(--accent)]' },
};

const defaultColor = { bg: 'bg-[#F9F9F9]', icon: 'text-[#757575]', badge: 'bg-[var(--light-purple)] text-[var(--primary)]' };

export default function PermissionsPage() {
  const [grouped, setGrouped] = useState<Record<string, Permission[]>>({});
  const [loading, setLoading] = useState(true);
  // Search and module filter — client-side (permissions are few and grouped)
  const [search, setSearch]         = useState('');
  const [moduleFilter, setModuleFilter] = useState('');

  useEffect(() => {
    fetch('/api/admin/permissions')
      .then((r) => r.json())
      .then((d) => setGrouped(d.grouped || {}))
      .finally(() => setLoading(false));
  }, []);

  const totalCount = Object.values(grouped).reduce((acc, p) => acc + p.length, 0);
  const allModules = Object.keys(grouped).sort();

  // Apply filters
  const filteredGrouped = Object.entries(grouped).reduce<Record<string, Permission[]>>((acc, [mod, perms]) => {
    if (moduleFilter && mod !== moduleFilter) return acc;
    const filtered = search
      ? perms.filter(
          (p) =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.slug.toLowerCase().includes(search.toLowerCase())
        )
      : perms;
    if (filtered.length > 0) acc[mod] = filtered;
    return acc;
  }, {});

  const filteredCount = Object.values(filteredGrouped).reduce((acc, p) => acc + p.length, 0);
  const isFiltered = search !== '' || moduleFilter !== '';

  return (
    <PermissionGuard permission="permissions.view">
    <div className="p-6 lg:p-8 w-full">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#2D2D2D] tracking-tight">Permissions</h1>
        <p className="text-[#757575] text-sm mt-1">
          {isFiltered
            ? <>{filteredCount} of {totalCount} permissions across {Object.keys(filteredGrouped).length} module{Object.keys(filteredGrouped).length !== 1 ? 's' : ''}</>
            : <>{totalCount} permissions across {allModules.length} modules</>
          }
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-[var(--light-purple)] border border-[color-mix(in_srgb,var(--primary)_20%,transparent)] rounded-2xl px-5 py-4 mb-6">
        <Lock size={16} className="text-[var(--primary)] mt-0.5 flex-shrink-0" />
        <p className="text-sm text-[var(--primary)]">
          Permissions are system-defined. To assign them to roles, go to{' '}
          <a href="/admin/roles" className="font-semibold underline underline-offset-2 hover:opacity-80">Roles</a>.
        </p>
      </div>

      {/* Search + Module filter */}
      {!loading && (
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          {/* Search input */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#757575]" />
            <input
              type="text"
              placeholder="Search permissions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#757575] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
            />
          </div>
          {/* Module filter dropdown */}
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="px-4 py-2.5 bg-white border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all sm:w-48 cursor-pointer"
          >
            <option value="">All modules</option>
            {allModules.map((mod) => (
              <option key={mod} value={mod}>{mod.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#E0E0E0] p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-[var(--light-purple)] rounded-xl" />
                <div className="space-y-1.5">
                  <div className="h-4 bg-[var(--light-purple)] rounded w-24" />
                  <div className="h-3 bg-[var(--light-purple)] rounded w-16" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[...Array(3)].map((_, j) => <div key={j} className="h-10 bg-[var(--light-purple)] rounded-xl" />)}
              </div>
            </div>
          ))}
        </div>
      ) : Object.keys(filteredGrouped).length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-[var(--light-purple)] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Key size={28} style={{ color: 'var(--primary)' }} />
          </div>
          <p className="text-[#757575] font-medium text-sm">
            No permissions match{search ? ` "${search}"` : ''}{moduleFilter ? ` in module "${moduleFilter}"` : ''}
          </p>
          {isFiltered && (
            <button
              onClick={() => { setSearch(''); setModuleFilter(''); }}
              className="text-sm hover:underline mt-1.5 inline-block"
              style={{ color: 'var(--primary)' }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(filteredGrouped).map(([module, perms]) => {
            const color = MODULE_COLORS[module] || defaultColor;
            return (
              <div key={module} className="bg-white rounded-2xl border border-[#E0E0E0] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#F9F9F9] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 ${color.bg} rounded-xl flex items-center justify-center`}>
                      <Key size={15} className={color.icon} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#2D2D2D] text-sm capitalize">{module.replace('_', ' ')}</h3>
                      <p className="text-xs text-[#757575]">{perms.length} permission{perms.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${color.badge}`}>
                    {perms.length}
                  </span>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {perms.map((perm) => (
                    <div
                      key={perm.id}
                      className="flex items-center gap-2.5 px-3.5 py-3 bg-[#F9F9F9] hover:bg-[var(--light-purple)] rounded-xl transition-colors"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${color.icon.replace('text-', 'bg-')}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#2D2D2D] leading-none">{perm.name}</p>
                        <p className="text-[11px] text-[#757575] font-mono mt-0.5 truncate">{perm.slug}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </PermissionGuard>
  );
}
