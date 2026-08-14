'use client';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Search, CheckCircle, XCircle, Clock, Users,
  ChevronLeft, ChevronRight, Inbox, Phone, Eye, X,
} from 'lucide-react';
import PermissionGuard from '@/components/admin/PermissionGuard';

interface PartnerRow {
  id: number;
  phone: string;
  name: string;
  gender: string;
  language: string;
  categories: string[];
  team_option: string;
  vehicle_type: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  id_front: string | null;
  id_back: string | null;
  selfie: string | null;
  bank_document: string | null;
}

const STATUS_STYLES: Record<string, { dot: string; text: string; bg: string; label: string }> = {
  pending:  { dot: 'bg-amber-400',  text: 'text-amber-700',  bg: 'bg-amber-50',  label: 'Pending'  },
  approved: { dot: 'bg-[#2E7D32]',  text: 'text-[#2E7D32]', bg: 'bg-green-50',  label: 'Approved' },
  rejected: { dot: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50',    label: 'Rejected' },
};

export default function PartnersPage() {
  const [partners, setPartners]   = useState<PartnerRow[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [statusTab, setStatusTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [loading, setLoading]     = useState(true);
  const [preview, setPreview]     = useState<PartnerRow | null>(null);
  const [acting, setActing]       = useState<number | null>(null);
  const limit = 10;

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/partners?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&status=${statusTab}`
      );
      const data = await res.json();
      if (res.ok) { setPartners(data.partners); setTotal(data.total); }
      else toast.error(data.error || 'Failed to load partners');
    } catch { toast.error('Failed to load partners'); }
    finally { setLoading(false); }
  }, [page, search, statusTab]);

  useEffect(() => { fetchPartners(); }, [fetchPartners]);

  const switchTab = (t: typeof statusTab) => { setStatusTab(t); setPage(1); setSearch(''); };

  const handleAction = async (id: number, action: 'approve' | 'reject', name: string) => {
    const verb = action === 'approve' ? 'Approve' : 'Reject';
    if (!confirm(`${verb} partner "${name || id}"?`)) return;
    setActing(id);
    try {
      const res = await fetch('/api/admin/partners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Partner ${action === 'approve' ? 'approved' : 'rejected'}`);
        setPreview(null);
        fetchPartners();
      } else {
        toast.error(data.error || 'Action failed');
      }
    } catch { toast.error('Action failed'); }
    finally { setActing(null); }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <PermissionGuard permission="users.view">
      <div className="p-6 lg:p-8 w-full">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#2D2D2D] tracking-tight">Partners</h1>
            <p className="text-[#757575] text-sm mt-1">{total} {statusTab === 'all' ? 'total' : statusTab} partners</p>
          </div>
        </div>

        {/* Tab bar + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <div className="flex items-center gap-1 bg-[var(--light-purple)] p-1 rounded-xl flex-shrink-0">
            {(['pending', 'approved', 'rejected', 'all'] as const).map((t) => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize"
                style={statusTab === t
                  ? { backgroundColor: 'white', color: 'var(--primary)', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }
                  : { color: '#757575' }}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="relative flex-1">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#757575]" />
            <input
              type="text"
              placeholder="Search by name or phone…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#757575] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-[#E0E0E0] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E0E0E0]">
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5">Partner</th>
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5 hidden md:table-cell">Phone</th>
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5 hidden lg:table-cell">Categories</th>
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5">Status</th>
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5 hidden lg:table-cell">Applied</th>
                  <th className="text-right text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i} className="border-b border-[#F9F9F9]">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[var(--light-purple)] animate-pulse flex-shrink-0" />
                          <div className="space-y-1.5">
                            <div className="h-3 bg-[var(--light-purple)] rounded w-28 animate-pulse" />
                            <div className="h-2.5 bg-[var(--light-purple)] rounded w-20 animate-pulse" />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell"><div className="h-3 bg-[var(--light-purple)] rounded w-24 animate-pulse" /></td>
                      <td className="px-6 py-4 hidden lg:table-cell"><div className="h-3 bg-[var(--light-purple)] rounded w-32 animate-pulse" /></td>
                      <td className="px-6 py-4"><div className="h-5 bg-[var(--light-purple)] rounded-full w-16 animate-pulse" /></td>
                      <td className="px-6 py-4 hidden lg:table-cell"><div className="h-3 bg-[var(--light-purple)] rounded w-20 animate-pulse" /></td>
                      <td className="px-6 py-4"><div className="h-7 bg-[var(--light-purple)] rounded w-20 ml-auto animate-pulse" /></td>
                    </tr>
                  ))
                ) : partners.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="w-14 h-14 bg-[var(--light-purple)] rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Users size={24} style={{ color: 'var(--primary)' }} />
                      </div>
                      <p className="text-[#757575] font-medium text-sm">No {statusTab === 'all' ? '' : statusTab} partners found</p>
                    </td>
                  </tr>
                ) : (
                  partners.map((partner) => {
                    const st = STATUS_STYLES[partner.status] || STATUS_STYLES.pending;
                    const initials = partner.name
                      ? partner.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
                      : partner.phone.slice(-2);
                    return (
                      <tr key={partner.id} className="border-b border-[#F9F9F9] last:border-0 hover:bg-[#F9F9F9]/60 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}
                            >
                              {initials}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-[#2D2D2D] leading-none">{partner.name || <span className="text-[#bdbdbd]">—</span>}</p>
                              <p className="text-xs text-[#757575] mt-0.5">{partner.gender} · {partner.language}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell">
                          <span className="inline-flex items-center gap-1.5 text-xs text-[#757575]">
                            <Phone size={11} />
                            {partner.phone}
                          </span>
                        </td>
                        <td className="px-6 py-4 hidden lg:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {(partner.categories || []).slice(0, 2).map((c) => (
                              <span key={c} className="px-2 py-0.5 bg-[var(--light-purple)] text-[10px] font-medium rounded-full" style={{ color: 'var(--primary)' }}>
                                {c}
                              </span>
                            ))}
                            {(partner.categories || []).length > 2 && (
                              <span className="px-2 py-0.5 bg-[#F9F9F9] text-[10px] text-[#757575] rounded-full">
                                +{partner.categories.length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${st.dot}`} />
                            {st.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 hidden lg:table-cell">
                          <span className="text-xs text-[#757575]">{new Date(partner.created_at).toLocaleDateString()}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setPreview(partner)}
                              className="p-2 text-[#757575] hover:bg-[var(--light-purple)] rounded-lg transition-all"
                              onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                              onMouseLeave={e => (e.currentTarget.style.color = '#757575')}
                              title="View details"
                            >
                              <Eye size={14} />
                            </button>
                            {partner.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleAction(partner.id, 'approve', partner.name)}
                                  disabled={acting === partner.id}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#2E7D32] bg-green-50 hover:bg-green-100 rounded-lg transition-all disabled:opacity-50"
                                  title="Approve"
                                >
                                  <CheckCircle size={12} />
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleAction(partner.id, 'reject', partner.name)}
                                  disabled={acting === partner.id}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-all disabled:opacity-50"
                                  title="Reject"
                                >
                                  <XCircle size={12} />
                                  Reject
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

      {/* Detail drawer / modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0E0E0]">
              <h2 className="text-base font-bold text-[#2D2D2D]">Partner Details</h2>
              <button onClick={() => setPreview(null)} className="p-1.5 text-[#757575] hover:bg-[#F9F9F9] rounded-lg transition-all">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Identity */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-[#757575] uppercase tracking-wider">Identity</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-[#757575]">Name</span><p className="font-medium text-[#2D2D2D]">{preview.name || '—'}</p></div>
                  <div><span className="text-[#757575]">Phone</span><p className="font-medium text-[#2D2D2D]">{preview.phone}</p></div>
                  <div><span className="text-[#757575]">Gender</span><p className="font-medium text-[#2D2D2D] capitalize">{preview.gender || '—'}</p></div>
                  <div><span className="text-[#757575]">Language</span><p className="font-medium text-[#2D2D2D]">{preview.language || '—'}</p></div>
                  <div><span className="text-[#757575]">Team</span><p className="font-medium text-[#2D2D2D]">{preview.team_option || '—'}</p></div>
                  <div><span className="text-[#757575]">Vehicle</span><p className="font-medium text-[#2D2D2D]">{preview.vehicle_type || '—'}</p></div>
                </div>
              </div>

              {/* Categories */}
              {preview.categories?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-[#757575] uppercase tracking-wider">Service Categories</p>
                  <div className="flex flex-wrap gap-1.5">
                    {preview.categories.map((c) => (
                      <span key={c} className="px-2.5 py-1 bg-[var(--light-purple)] text-xs font-medium rounded-full" style={{ color: 'var(--primary)' }}>
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-[#757575] uppercase tracking-wider">Documents</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'ID Front', url: preview.id_front },
                    { label: 'ID Back',  url: preview.id_back  },
                    { label: 'Selfie',   url: preview.selfie   },
                    { label: 'Bank Doc', url: preview.bank_document },
                  ].map(({ label, url }) => (
                    <div key={label} className="border border-[#E0E0E0] rounded-xl overflow-hidden">
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt={label} className="w-full h-28 object-cover hover:opacity-90 transition-opacity" />
                        </a>
                      ) : (
                        <div className="w-full h-28 bg-[#F9F9F9] flex items-center justify-center">
                          <Inbox size={20} className="text-[#bdbdbd]" />
                        </div>
                      )}
                      <p className="text-[10px] font-medium text-[#757575] text-center py-1.5 border-t border-[#E0E0E0]">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status + action buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-[#F9F9F9]">
                <div>
                  <p className="text-[11px] text-[#757575] mb-1">Current Status</p>
                  {(() => {
                    const st = STATUS_STYLES[preview.status];
                    return (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    );
                  })()}
                </div>
                {preview.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(preview.id, 'reject', preview.name)}
                      disabled={acting === preview.id}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition-all disabled:opacity-50"
                    >
                      <XCircle size={14} />
                      Reject
                    </button>
                    <button
                      onClick={() => handleAction(preview.id, 'approve', preview.name)}
                      disabled={acting === preview.id}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-50"
                      style={{ backgroundColor: 'var(--primary)' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--primary-dark)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--primary)')}
                    >
                      <CheckCircle size={14} />
                      Approve
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </PermissionGuard>
  );
}
