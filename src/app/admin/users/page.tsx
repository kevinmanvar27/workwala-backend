'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2, Users, ChevronLeft, ChevronRight, RotateCcw, Inbox } from 'lucide-react';
import PermissionGuard from '@/components/admin/PermissionGuard';
import { apiFetch } from '@/lib/apiFetch';

interface UserRow {
  id: number; name: string; email: string; avatar?: string;
  role_name: string; status: string; created_at: string;
}

const STATUS: Record<string, { dot: string; text: string; bg: string }> = {
  active:   { dot: 'bg-[#2E7D32]', text: 'text-[#2E7D32]', bg: 'bg-green-50' },
  inactive: { dot: 'bg-[#757575]', text: 'text-[#757575]', bg: 'bg-[#F9F9F9]' },
  banned:   { dot: 'bg-red-500',   text: 'text-red-700',   bg: 'bg-red-50' },
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'deleted'>('active');
  const limit = 10;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&deleted=${tab === 'deleted' ? '1' : '0'}`
      );
      const data = await res.json();
      if (res.ok) { setUsers(data.users); setTotal(data.total); }
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  }, [page, search, tab]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const switchTab = (t: 'active' | 'deleted') => { setTab(t); setPage(1); setSearch(''); };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Soft-delete user "${name}"?`)) return;
    const res = await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('User removed'); fetchUsers(); }
    else toast.error('Failed to delete user');
  };

  const handleRestore = async (id: number, name: string) => {
    if (!confirm(`Restore user "${name}"?`)) return;
    const res = await apiFetch(`/api/admin/users/${id}`, { method: 'PATCH' });
    if (res.ok) { toast.success(`"${name}" restored`); fetchUsers(); }
    else toast.error('Failed to restore user');
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <PermissionGuard permission="users.view">
    <div className="p-6 lg:p-8 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#2D2D2D] tracking-tight">Users</h1>
          <p className="text-[#757575] text-sm mt-1">{total} {tab === 'deleted' ? 'deleted' : 'total'} members</p>
        </div>
        {tab === 'active' && (
          <Link
            href="/admin/users/new"
            className="inline-flex items-center gap-2 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm hover:-translate-y-px"
            style={{ backgroundColor: 'var(--primary)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--primary-dark)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--primary)')}
          >
            <Plus size={15} />
            Add User
          </Link>
        )}
      </div>

      {/* Tab bar + Search row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-[var(--light-purple)] p-1 rounded-xl flex-shrink-0">
          <button
            onClick={() => switchTab('active')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all`}
            style={tab === 'active' ? { backgroundColor: 'white', color: 'var(--primary)', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' } : { color: '#757575' }}
          >
            Active
          </button>
          <button
            onClick={() => switchTab('deleted')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'deleted' ? 'bg-white text-red-600 shadow-sm' : 'text-[#757575] hover:text-[#2D2D2D]'
            }`}
          >
            <Trash2 size={13} />
            Deleted
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#757575]" />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-11 pr-4 py-2.5 bg-white border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#757575] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Deleted banner */}
      {tab === 'deleted' && (
        <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-sm text-amber-800">
          <RotateCcw size={15} className="text-amber-500 flex-shrink-0" />
          These users have been soft-deleted. Click <strong>Restore</strong> to bring them back.
        </div>
      )}

      {/* Table card */}
      <div className="bg-white rounded-2xl border border-[#E0E0E0] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E0E0E0]">
                {/* Sr. No. column header */}
                <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5 w-12">Sr.</th>
                <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5">User</th>
                <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5 hidden md:table-cell">Role</th>
                {tab === 'active' && (
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5">Status</th>
                )}
                <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5 hidden lg:table-cell">
                  {tab === 'deleted' ? 'Deleted' : 'Joined'}
                </th>
                <th className="text-right text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-b border-[#F9F9F9]">
                    {/* Sr. No. skeleton */}
                    <td className="px-6 py-4"><div className="h-3 bg-[var(--light-purple)] rounded w-6 animate-pulse" /></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[var(--light-purple)] animate-pulse flex-shrink-0" />
                        <div className="space-y-1.5">
                          <div className="h-3 bg-[var(--light-purple)] rounded w-28 animate-pulse" />
                          <div className="h-2.5 bg-[var(--light-purple)] rounded w-40 animate-pulse" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell"><div className="h-3 bg-[var(--light-purple)] rounded w-16 animate-pulse" /></td>
                    {tab === 'active' && <td className="px-6 py-4"><div className="h-5 bg-[var(--light-purple)] rounded-full w-16 animate-pulse" /></td>}
                    <td className="px-6 py-4 hidden lg:table-cell"><div className="h-3 bg-[var(--light-purple)] rounded w-20 animate-pulse" /></td>
                    <td className="px-6 py-4"><div className="h-7 bg-[var(--light-purple)] rounded w-16 ml-auto animate-pulse" /></td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={tab === 'active' ? 6 : 5} className="px-6 py-20 text-center">
                    <div className="w-14 h-14 bg-[var(--light-purple)] rounded-2xl flex items-center justify-center mx-auto mb-4">
                      {tab === 'deleted' ? <Inbox size={24} className="text-[#757575]" /> : <Users size={24} style={{ color: 'var(--primary)' }} />}
                    </div>
                    <p className="text-[#757575] font-medium text-sm">
                      {tab === 'deleted' ? 'No deleted users' : 'No users found'}
                    </p>
                    {tab === 'active' && (
                      <Link href="/admin/users/new" className="text-sm hover:underline mt-1.5 inline-block" style={{ color: 'var(--primary)' }}>
                        Add your first user →
                      </Link>
                    )}
                  </td>
                </tr>
              ) : (
                users.map((user, index) => {
                  // Calculate serial number based on current page
                  const srNo = (page - 1) * limit + index + 1;
                  const st = STATUS[user.status] || STATUS.inactive;
                  return (
                    <tr
                      key={user.id}
                      className={`border-b border-[#F9F9F9] last:border-0 transition-colors ${
                        tab === 'deleted' ? 'opacity-60 hover:opacity-80 bg-[#F9F9F9]/40' : 'hover:bg-[#F9F9F9]/60'
                      }`}
                    >
                      {/* Sr. No. cell */}
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-[#757575]">{srNo}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {/* Avatar — brand gradient via CSS vars */}
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}
                          >
                            {user.avatar
                              ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                              : user.name[0].toUpperCase()
                            }
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#2D2D2D] leading-none">{user.name}</p>
                            <p className="text-xs text-[#757575] mt-0.5">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <span className="text-xs text-[#757575]">{user.role_name || <span className="text-[#bdbdbd]">—</span>}</span>
                      </td>
                      {tab === 'active' && (
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${st.dot}`} />
                            {user.status}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-4 hidden lg:table-cell">
                        <span className="text-xs text-[#757575]">{new Date(user.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {tab === 'deleted' ? (
                            <button
                              onClick={() => handleRestore(user.id, user.name)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#2E7D32] bg-green-50 hover:bg-green-100 rounded-lg transition-all"
                              title="Restore user"
                            >
                              <RotateCcw size={12} />
                              Restore
                            </button>
                          ) : (
                            <>
                              <Link
                                href={`/admin/users/${user.id}`}
                                className="p-2 text-[#757575] hover:bg-[var(--light-purple)] rounded-lg transition-all"
                                style={{ color: undefined }}
                                onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                                onMouseLeave={e => (e.currentTarget.style.color = '#757575')}
                                title="Edit"
                              >
                                <Pencil size={14} />
                              </Link>
                              <button
                                onClick={() => handleDelete(user.id, user.name)}
                                className="p-2 text-[#757575] hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-[#F9F9F9] flex items-center justify-between">
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
      </div>
    </div>
    </PermissionGuard>
  );
}
