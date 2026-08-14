'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2, FileText, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import PermissionGuard from '@/components/admin/PermissionGuard';

interface PageRow { id: number; title: string; slug: string; status: string; created_at: string; }

export default function AdminPagesPage() {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 10;

  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/pages?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (res.ok) { setPages(data.pages); setTotal(data.total); }
    } catch { toast.error('Failed to load pages'); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Delete page "${title}"?`)) return;
    const res = await fetch(`/api/admin/pages/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Page deleted'); fetchPages(); }
    else toast.error('Failed to delete page');
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <PermissionGuard permission="pages.view">
    <div className="p-6 lg:p-8 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#2D2D2D] tracking-tight">Pages</h1>
          <p className="text-[#757575] text-sm mt-1">{total} total pages</p>
        </div>
        <Link
          href="/admin/pages/new"
          className="inline-flex items-center gap-2 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm hover:-translate-y-px"
          style={{ backgroundColor: 'var(--primary)' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--primary-dark)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--primary)')}
        >
          <Plus size={15} />
          Add Page
        </Link>
      </div>

      <div className="relative mb-5">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#757575]" />
        <input
          type="text"
          placeholder="Search pages…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-11 pr-4 py-2.5 bg-white border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#757575] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
        />
      </div>

      <div className="bg-white rounded-2xl border border-[#E0E0E0] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E0E0E0]">
                <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5">Title</th>
                <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5 hidden md:table-cell">Slug</th>
                <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5">Status</th>
                <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5 hidden lg:table-cell">Created</th>
                <th className="text-right text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b border-[#F9F9F9]">
                    <td className="px-6 py-4"><div className="h-4 bg-[var(--light-purple)] rounded w-40 animate-pulse" /></td>
                    <td className="px-6 py-4 hidden md:table-cell"><div className="h-3 bg-[var(--light-purple)] rounded w-28 animate-pulse" /></td>
                    <td className="px-6 py-4"><div className="h-5 bg-[var(--light-purple)] rounded-full w-20 animate-pulse" /></td>
                    <td className="px-6 py-4 hidden lg:table-cell"><div className="h-3 bg-[var(--light-purple)] rounded w-20 animate-pulse" /></td>
                    <td className="px-6 py-4"><div className="h-7 bg-[var(--light-purple)] rounded w-16 ml-auto animate-pulse" /></td>
                  </tr>
                ))
              ) : pages.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="w-14 h-14 bg-[var(--light-purple)] rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <FileText size={24} style={{ color: 'var(--primary)' }} />
                    </div>
                    <p className="text-[#757575] font-medium text-sm">No pages found</p>
                    <Link href="/admin/pages/new" className="text-sm hover:underline mt-1.5 inline-block" style={{ color: 'var(--primary)' }}>
                      Create your first page →
                    </Link>
                  </td>
                </tr>
              ) : (
                pages.map((p) => (
                  <tr key={p.id} className="border-b border-[#F9F9F9] last:border-0 hover:bg-[#F9F9F9]/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 bg-[var(--light-purple)] rounded-lg flex items-center justify-center flex-shrink-0">
                          <FileText size={13} style={{ color: 'var(--primary)' }} />
                        </div>
                        <p className="text-sm font-semibold text-[#2D2D2D]">{p.title}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <code className="text-xs text-[#757575] bg-[#F9F9F9] px-2 py-1 rounded-lg font-mono">{p.slug}</code>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        p.status === 'published'
                          ? 'bg-green-50 text-[#2E7D32]'
                          : 'bg-[#F9F9F9] text-[#757575]'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'published' ? 'bg-[#2E7D32]' : 'bg-[#757575]'}`} />
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <span className="text-xs text-[#757575]">{new Date(p.created_at).toLocaleDateString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {p.status === 'published' && (
                          <Link
                            href={`/pages/${p.slug}`}
                            target="_blank"
                            className="p-2 text-[#757575] hover:text-[#2E7D32] hover:bg-green-50 rounded-lg transition-all"
                            title="View"
                          >
                            <ExternalLink size={14} />
                          </Link>
                        )}
                        <Link
                          href={`/admin/pages/${p.id}`}
                          className="p-2 text-[#757575] hover:bg-[var(--light-purple)] rounded-lg transition-all"
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#757575')}
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </Link>
                        <button
                          onClick={() => handleDelete(p.id, p.title)}
                          className="p-2 text-[#757575] hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-[#F9F9F9] flex items-center justify-between">
            <p className="text-xs text-[#757575]">
              Showing <span className="font-medium text-[#2D2D2D]">{(page - 1) * limit + 1}–{Math.min(page * limit, total)}</span> of <span className="font-medium text-[#2D2D2D]">{total}</span>
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-[#E0E0E0] text-[#757575] hover:bg-[#F9F9F9] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                <ChevronLeft size={15} />
              </button>
              <span className="px-3 py-1.5 text-xs font-medium text-[#2D2D2D]">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg border border-[#E0E0E0] text-[#757575] hover:bg-[#F9F9F9] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
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
