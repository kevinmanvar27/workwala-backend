'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2, Shield, Users, Key, ChevronLeft, ChevronRight } from 'lucide-react';
import PermissionGuard from '@/components/admin/PermissionGuard';
import { apiFetch } from '@/lib/apiFetch';

interface RoleRow {
  id: number; name: string; slug: string; description: string;
  permission_count: number; user_count: number; created_at: string;
}

const ROLE_GRAD_ANGLES = [135, 150, 120, 160, 140];

export default function RolesPage() {
  const [roles, setRoles]   = useState<RoleRow[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 10;

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/roles?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`
      );
      const data = await res.json();
      if (res.ok) { setRoles(data.roles); setTotal(data.total); }
    } catch { toast.error('Failed to load roles'); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete role "${name}"? Users with this role will lose it.`)) return;
    const res = await apiFetch(`/api/admin/roles/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Role deleted'); fetchRoles(); }
    else toast.error('Failed to delete role');
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <PermissionGuard permission="roles.view">
    <div className="p-6 lg:p-8 w-full">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#2D2D2D] tracking-tight">Roles</h1>
          <p className="text-[#757575] text-sm mt-1">{total} role{total !== 1 ? 's' : ''} configured</p>
        </div>
        <Link
          href="/admin/roles/new"
          className="inline-flex items-center gap-2 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm hover:-translate-y-px"
          style={{ backgroundColor: 'var(--primary)' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--primary-dark)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--primary)')}
        >
          <Plus size={15} />
          Add Role
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#757575]" />
        <input
          type="text"
          placeholder="Search roles…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-11 pr-4 py-2.5 bg-white border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#757575] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#E0E0E0] p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 bg-[var(--light-purple)] rounded-xl" />
                <div className="space-y-1.5">
                  <div className="h-4 bg-[var(--light-purple)] rounded w-24" />
                  <div className="h-3 bg-[var(--light-purple)] rounded w-16" />
                </div>
              </div>
              <div className="h-3 bg-[var(--light-purple)] rounded w-full mb-4" />
              <div className="flex gap-4 pt-3 border-t border-[#E0E0E0]">
                <div className="h-3 bg-[var(--light-purple)] rounded w-20" />
                <div className="h-3 bg-[var(--light-purple)] rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : roles.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-[var(--light-purple)] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield size={28} style={{ color: 'var(--primary)' }} />
          </div>
          <p className="text-[#757575] font-medium text-sm">
            {search ? `No roles matching "${search}"` : 'No roles yet'}
          </p>
          {!search && (
            <Link href="/admin/roles/new" className="text-sm hover:underline mt-1.5 inline-block" style={{ color: 'var(--primary)' }}>
              Create your first role →
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((role, idx) => (
              <div
                key={role.id}
                className="bg-white rounded-2xl border border-[#E0E0E0] p-5 hover:border-[#bdbdbd] hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform"
                      style={{ background: `linear-gradient(${ROLE_GRAD_ANGLES[idx % ROLE_GRAD_ANGLES.length]}deg, var(--primary), var(--accent))` }}
                    >
                      <Shield size={18} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#2D2D2D] text-sm leading-none">{role.name}</h3>
                      <p className="text-[11px] text-[#757575] font-mono mt-1">{role.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link
                      href={`/admin/roles/${role.id}`}
                      className="p-1.5 text-[#757575] hover:bg-[var(--light-purple)] rounded-lg transition-all"
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#757575')}
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </Link>
                    <button
                      onClick={() => handleDelete(role.id, role.name)}
                      className="p-1.5 text-[#757575] hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {role.description && (
                  <p className="text-xs text-[#757575] mb-4 line-clamp-2">{role.description}</p>
                )}

                <div className="flex items-center gap-4 pt-3 border-t border-[#E0E0E0]">
                  <div className="flex items-center gap-1.5 text-xs text-[#757575]">
                    <Key size={12} className="text-[#bdbdbd]" />
                    <span><span className="font-semibold text-[#2D2D2D]">{role.permission_count}</span> permissions</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[#757575]">
                    <Users size={12} className="text-[#bdbdbd]" />
                    <span><span className="font-semibold text-[#2D2D2D]">{role.user_count}</span> users</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-5 flex items-center justify-between">
              <p className="text-xs text-[#757575]">
                Showing <span className="font-medium text-[#2D2D2D]">{(page - 1) * limit + 1}–{Math.min(page * limit, total)}</span> of <span className="font-medium text-[#2D2D2D]">{total}</span>
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-[#E0E0E0] text-[#757575] hover:bg-[#F9F9F9] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="px-3 py-1.5 text-xs font-medium text-[#2D2D2D]">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-[#E0E0E0] text-[#757575] hover:bg-[#F9F9F9] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
    </PermissionGuard>
  );
}
