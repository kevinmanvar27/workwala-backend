'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import {
  Search, CheckCircle, XCircle, Users,
  ChevronLeft, ChevronRight, Inbox, Phone, Eye, X,
  Pencil, AlertTriangle, Save, ChevronDown, Plus,
  UserPlus, Tag,
} from 'lucide-react';
import PermissionGuard from '@/components/admin/PermissionGuard';
import { apiFetch } from '@/lib/apiFetch';

interface PartnerRow {
  id: number;
  phone: string;
  name: string;
  gender: string;
  language: string;
  categories: string[];
  team_option: string;
  vehicle_type: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended' | 'inactive' | 'banned';
  created_at: string;
  id_front: string | null;
  id_back: string | null;
  selfie: string | null;
  bank_document: string | null;
}

// All possible statuses with styling
const STATUS_STYLES: Record<string, { dot: string; text: string; bg: string; label: string; icon?: React.ReactNode }> = {
  pending:   { dot: 'bg-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50',   label: 'Pending'   },
  approved:  { dot: 'bg-[#2E7D32]',   text: 'text-[#2E7D32]',  bg: 'bg-green-50',   label: 'Approved'  },
  rejected:  { dot: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50',     label: 'Rejected'  },
  suspended: { dot: 'bg-orange-500',  text: 'text-orange-700',  bg: 'bg-orange-50',  label: 'Suspended' },
  inactive:  { dot: 'bg-[#757575]',   text: 'text-[#757575]',   bg: 'bg-[#F9F9F9]', label: 'Inactive'  },
  banned:    { dot: 'bg-rose-600',    text: 'text-rose-700',    bg: 'bg-rose-50',    label: 'Banned'    },
};

const ALL_STATUSES = ['pending', 'approved', 'rejected', 'suspended', 'inactive', 'banned'] as const;
type PartnerStatus = typeof ALL_STATUSES[number];

// Status tab options (subset shown as tabs)
const TAB_OPTIONS = ['pending', 'approved', 'rejected', 'suspended', 'all'] as const;
type StatusTab = typeof TAB_OPTIONS[number];

// Shared form shape (used for both Add and Edit)
interface PartnerForm {
  name: string;
  phone: string;
  gender: string;
  language: string;
  team_option: string;
  vehicle_type: string;
  categories: string[];   // array of selected category names
  status: PartnerStatus;
}

// Legacy alias kept for edit (uses string for free-text input)
interface EditForm {
  name: string;
  phone: string;
  gender: string;
  language: string;
  team_option: string;
  vehicle_type: string;
  categories: string;
  status: PartnerStatus;
}

interface CategoryOption { id: number; name: string; }

export default function PartnersPage() {
  const [partners, setPartners]   = useState<PartnerRow[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('pending');
  const [loading, setLoading]     = useState(true);
  const [preview, setPreview]     = useState<PartnerRow | null>(null);
  const [acting, setActing]       = useState<number | null>(null);

  // Edit modal state
  const [editTarget, setEditTarget] = useState<PartnerRow | null>(null);
  const [editForm, setEditForm]     = useState<EditForm | null>(null);
  const [saving, setSaving]         = useState(false);

  // Add partner modal state
  const BLANK_ADD: PartnerForm = { name: '', phone: '', gender: '', language: '', team_option: '', vehicle_type: '', categories: [], status: 'approved' };
  const [addOpen, setAddOpen]     = useState(false);
  const [addForm, setAddForm]     = useState<PartnerForm>(BLANK_ADD);
  const [addSaving, setAddSaving] = useState(false);

  // Category options for the multi-select in Add modal
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);

  // Status dropdown — tracks which row is open + fixed pixel position
  const [statusDropdown, setStatusDropdown] = useState<{ id: number; top: number; left: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Fetch categories once for the Add modal dropdown
  useEffect(() => {
    fetch('/api/admin/categories')
      .then(r => r.json())
      .then(d => { if (d.categories) setCategoryOptions(d.categories.filter((c: any) => c.is_active)); })
      .catch(() => {});
  }, []);

  // Close status dropdown when clicking outside
  useEffect(() => {
    if (!statusDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setStatusDropdown(null);
      }
    };
    // Use mousedown so it fires before any click handler on the trigger button
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [statusDropdown]);

  const switchTab = (t: StatusTab) => { setStatusTab(t); setPage(1); setSearch(''); };

  // Approve / Reject quick action
  const handleAction = async (id: number, action: 'approve' | 'reject', name: string) => {
    const verb = action === 'approve' ? 'Approve' : 'Reject';
    if (!confirm(`${verb} partner "${name || id}"?`)) return;
    setActing(id);
    try {
      const res = await apiFetch('/api/admin/partners', {
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

  // Quick status change from dropdown
  const handleSetStatus = async (id: number, status: PartnerStatus, name: string) => {
    setStatusDropdown(null);
    setActing(id);
    try {
      const res = await apiFetch('/api/admin/partners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'set_status', status }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${name || 'Partner'} marked as ${STATUS_STYLES[status].label}`);
        fetchPartners();
        // Update preview if open
        if (preview?.id === id) setPreview(prev => prev ? { ...prev, status } : null);
      } else {
        toast.error(data.error || 'Failed to update status');
      }
    } catch { toast.error('Failed to update status'); }
    finally { setActing(null); }
  };

  // Add new partner
  const handleAddPartner = async () => {
    const phone = addForm.phone.replace(/\D/g, '').slice(-10);
    if (phone.length !== 10) {
      toast.error('Enter a valid 10-digit phone number');
      return;
    }
    setAddSaving(true);
    try {
      const res = await apiFetch('/api/admin/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          name:         addForm.name.trim()         || undefined,
          gender:       addForm.gender               || undefined,
          language:     addForm.language.trim()      || undefined,
          team_option:  addForm.team_option          || undefined,
          vehicle_type: addForm.vehicle_type.trim()  || undefined,
          categories:   addForm.categories.length ? addForm.categories : undefined,
          status:       addForm.status,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Partner "${addForm.name || phone}" added successfully`);
        setAddOpen(false);
        setAddForm(BLANK_ADD);
        fetchPartners();
      } else {
        toast.error(data.error || 'Failed to add partner');
      }
    } catch { toast.error('Failed to add partner'); }
    finally { setAddSaving(false); }
  };

  // Toggle a category in the add form
  const toggleAddCategory = (name: string) => {
    setAddForm(f => ({
      ...f,
      categories: f.categories.includes(name)
        ? f.categories.filter(c => c !== name)
        : [...f.categories, name],
    }));
  };

  // Open edit modal
  const openEdit = (partner: PartnerRow) => {
    setEditTarget(partner);
    setEditForm({
      name:         partner.name || '',
      phone:        partner.phone || '',
      gender:       partner.gender || '',
      language:     partner.language || '',
      team_option:  partner.team_option || '',
      vehicle_type: partner.vehicle_type || '',
      categories:   (partner.categories || []).join(', '),
      status:       partner.status,
    });
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!editTarget || !editForm) return;
    setSaving(true);
    try {
      const categoriesArr = editForm.categories
        .split(',')
        .map(c => c.trim())
        .filter(Boolean);

      const res = await apiFetch('/api/admin/partners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id:           editTarget.id,
          action:       'edit',
          name:         editForm.name         || undefined,
          phone:        editForm.phone        || undefined,
          gender:       editForm.gender       || undefined,
          language:     editForm.language     || undefined,
          team_option:  editForm.team_option  || undefined,
          vehicle_type: editForm.vehicle_type || undefined,
          categories:   categoriesArr.length ? categoriesArr : undefined,
          status:       editForm.status,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Partner updated');
        setEditTarget(null);
        setEditForm(null);
        // Also close detail preview if open for same partner
        if (preview?.id === editTarget.id) setPreview(null);
        fetchPartners();
      } else {
        toast.error(data.error || 'Failed to save');
      }
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
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
          <button
            onClick={() => { setAddForm(BLANK_ADD); setAddOpen(true); }}
            className="inline-flex items-center gap-2 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm hover:-translate-y-px flex-shrink-0"
            style={{ backgroundColor: 'var(--primary)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--primary-dark)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--primary)')}
          >
            <UserPlus size={15} />
            Add Partner
          </button>
        </div>

        {/* Tab bar + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <div className="flex items-center gap-1 bg-[var(--light-purple)] p-1 rounded-xl flex-shrink-0 flex-wrap">
            {TAB_OPTIONS.map((t) => (
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
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5 w-12">Sr.</th>
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
                      <td className="px-6 py-4"><div className="h-3 bg-[var(--light-purple)] rounded w-6 animate-pulse" /></td>
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
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="w-14 h-14 bg-[var(--light-purple)] rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Users size={24} style={{ color: 'var(--primary)' }} />
                      </div>
                      <p className="text-[#757575] font-medium text-sm">No {statusTab === 'all' ? '' : statusTab} partners found</p>
                    </td>
                  </tr>
                ) : (
                  partners.map((partner, index) => {
                    const srNo = (page - 1) * limit + index + 1;
                    const st = STATUS_STYLES[partner.status] || STATUS_STYLES.pending;
                    const initials = partner.name
                      ? partner.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
                      : partner.phone.slice(-2);
                    return (
                      <tr key={partner.id} className="border-b border-[#F9F9F9] last:border-0 hover:bg-[#F9F9F9]/60 transition-colors">
                        <td className="px-6 py-4">
                          <span className="text-xs font-medium text-[#757575]">{srNo}</span>
                        </td>
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

                        {/* Clickable phone number */}
                        <td className="px-6 py-4 hidden md:table-cell">
                          <a
                            href={`tel:${partner.phone}`}
                            className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
                            style={{ color: 'var(--primary)' }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                            title={`Call ${partner.phone}`}
                          >
                            <Phone size={11} />
                            {partner.phone}
                          </a>
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

                        {/* Status badge — click opens fixed-position portal dropdown */}
                        <td className="px-6 py-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (statusDropdown?.id === partner.id) {
                                setStatusDropdown(null);
                              } else {
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                setStatusDropdown({ id: partner.id, top: rect.bottom + 6, left: rect.left });
                              }
                            }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${st.bg} ${st.text}`}
                            title="Change status"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${st.dot}`} />
                            {st.label}
                            <ChevronDown size={10} className="ml-0.5 opacity-60" />
                          </button>
                        </td>

                        <td className="px-6 py-4 hidden lg:table-cell">
                          <span className="text-xs text-[#757575]">{new Date(partner.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            {/* View */}
                            <button
                              onClick={() => setPreview(partner)}
                              className="p-2 text-[#757575] hover:bg-[var(--light-purple)] rounded-lg transition-all"
                              onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                              onMouseLeave={e => (e.currentTarget.style.color = '#757575')}
                              title="View details"
                            >
                              <Eye size={14} />
                            </button>
                            {/* Edit */}
                            <button
                              onClick={() => openEdit(partner)}
                              className="p-2 text-[#757575] hover:bg-[var(--light-purple)] rounded-lg transition-all"
                              onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                              onMouseLeave={e => (e.currentTarget.style.color = '#757575')}
                              title="Edit partner"
                            >
                              <Pencil size={14} />
                            </button>
                            {/* Approve / Reject for pending */}
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

      {/* ── Status dropdown portal — renders outside table to escape overflow:hidden ── */}
      {statusDropdown && typeof window !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: statusDropdown.top, left: statusDropdown.left, zIndex: 9999 }}
          className="bg-white border border-[#E0E0E0] rounded-xl shadow-xl py-1 min-w-[152px]"
          onMouseDown={e => e.stopPropagation()}
        >
          {ALL_STATUSES.map((s) => {
            const sst = STATUS_STYLES[s];
            const isCurrent = partners.find(p => p.id === statusDropdown.id)?.status === s;
            return (
              <button
                key={s}
                disabled={isCurrent || acting === statusDropdown.id}
                onClick={() => {
                  const partner = partners.find(p => p.id === statusDropdown.id);
                  if (partner) handleSetStatus(partner.id, s, partner.name);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isCurrent ? 'bg-[#F9F9F9]' : 'hover:bg-[#F9F9F9]'}`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sst.dot}`} />
                <span className={sst.text}>{sst.label}</span>
                {isCurrent && <span className="ml-auto text-[10px] text-[#bdbdbd]">current</span>}
              </button>
            );
          })}
        </div>,
        document.body
      )}

      {/* ── Detail / View Modal ── */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0E0E0]">
              <h2 className="text-base font-bold text-[#2D2D2D]">Partner Details</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setPreview(null); openEdit(preview); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
                  style={{ backgroundColor: 'var(--light-purple)', color: 'var(--primary)' }}
                  title="Edit partner"
                >
                  <Pencil size={12} />
                  Edit
                </button>
                <button onClick={() => setPreview(null)} className="p-1.5 text-[#757575] hover:bg-[#F9F9F9] rounded-lg transition-all">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Identity */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-[#757575] uppercase tracking-wider">Identity</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-[#757575]">Name</span><p className="font-medium text-[#2D2D2D]">{preview.name || '—'}</p></div>
                  <div>
                    <span className="text-[#757575]">Phone</span>
                    <p className="font-medium">
                      <a
                        href={`tel:${preview.phone}`}
                        className="inline-flex items-center gap-1 transition-opacity hover:opacity-70"
                        style={{ color: 'var(--primary)' }}
                      >
                        <Phone size={12} />
                        {preview.phone}
                      </a>
                    </p>
                  </div>
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
                    const st = STATUS_STYLES[preview.status] || STATUS_STYLES.pending;
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
                {/* Quick suspend button for approved partners */}
                {preview.status === 'approved' && (
                  <button
                    onClick={() => handleSetStatus(preview.id, 'suspended', preview.name)}
                    disabled={acting === preview.id}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-xl transition-all disabled:opacity-50"
                  >
                    <AlertTriangle size={14} />
                    Suspend
                  </button>
                )}
                {/* Re-activate suspended/inactive */}
                {(preview.status === 'suspended' || preview.status === 'inactive') && (
                  <button
                    onClick={() => handleSetStatus(preview.id, 'approved', preview.name)}
                    disabled={acting === preview.id}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-[#2E7D32] bg-green-50 hover:bg-green-100 rounded-xl transition-all disabled:opacity-50"
                  >
                    <CheckCircle size={14} />
                    Reactivate
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editTarget && editForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => { setEditTarget(null); setEditForm(null); }}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Edit header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0E0E0]">
              <div>
                <h2 className="text-base font-bold text-[#2D2D2D]">Edit Partner</h2>
                <p className="text-xs text-[#757575] mt-0.5">{editTarget.name || editTarget.phone}</p>
              </div>
              <button onClick={() => { setEditTarget(null); setEditForm(null); }} className="p-1.5 text-[#757575] hover:bg-[#F9F9F9] rounded-lg transition-all">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">

              {/* Name + Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#757575] uppercase tracking-wider mb-1.5">Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={e => setEditForm(f => f ? { ...f, name: e.target.value } : f)}
                    placeholder="Full name"
                    className="w-full px-3 py-2 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#bdbdbd] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#757575] uppercase tracking-wider mb-1.5">Phone</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={e => setEditForm(f => f ? { ...f, phone: e.target.value } : f)}
                    placeholder="+91 XXXXX XXXXX"
                    className="w-full px-3 py-2 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#bdbdbd] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Gender + Language */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#757575] uppercase tracking-wider mb-1.5">Gender</label>
                  <select
                    value={editForm.gender}
                    onChange={e => setEditForm(f => f ? { ...f, gender: e.target.value } : f)}
                    className="w-full px-3 py-2 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all bg-white"
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#757575] uppercase tracking-wider mb-1.5">Language</label>
                  <input
                    type="text"
                    value={editForm.language}
                    onChange={e => setEditForm(f => f ? { ...f, language: e.target.value } : f)}
                    placeholder="e.g. Hindi, English"
                    className="w-full px-3 py-2 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#bdbdbd] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Team + Vehicle */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#757575] uppercase tracking-wider mb-1.5">Team Option</label>
                  <input
                    type="text"
                    value={editForm.team_option}
                    onChange={e => setEditForm(f => f ? { ...f, team_option: e.target.value } : f)}
                    placeholder="Solo / Team"
                    className="w-full px-3 py-2 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#bdbdbd] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#757575] uppercase tracking-wider mb-1.5">Vehicle Type</label>
                  <input
                    type="text"
                    value={editForm.vehicle_type}
                    onChange={e => setEditForm(f => f ? { ...f, vehicle_type: e.target.value } : f)}
                    placeholder="Bike / Car / None"
                    className="w-full px-3 py-2 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#bdbdbd] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Categories */}
              <div>
                <label className="block text-[11px] font-semibold text-[#757575] uppercase tracking-wider mb-1.5">
                  Categories <span className="font-normal normal-case text-[#bdbdbd]">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={editForm.categories}
                  onChange={e => setEditForm(f => f ? { ...f, categories: e.target.value } : f)}
                  placeholder="Plumbing, Electrical, Cleaning"
                  className="w-full px-3 py-2 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#bdbdbd] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-[11px] font-semibold text-[#757575] uppercase tracking-wider mb-1.5">Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {ALL_STATUSES.map((s) => {
                    const sst = STATUS_STYLES[s];
                    const isSelected = editForm.status === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setEditForm(f => f ? { ...f, status: s } : f)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                          isSelected
                            ? `${sst.bg} ${sst.text} border-current`
                            : 'bg-white text-[#757575] border-[#E0E0E0] hover:bg-[#F9F9F9]'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sst.dot}`} />
                        {sst.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status descriptions */}
              <div className="bg-[#F9F9F9] rounded-xl p-3 space-y-1">
                {[
                  { s: 'pending',   desc: 'Application submitted, awaiting review' },
                  { s: 'approved',  desc: 'Verified and active on the platform' },
                  { s: 'rejected',  desc: 'Application denied' },
                  { s: 'suspended', desc: 'Temporarily blocked (policy violation, dispute)' },
                  { s: 'inactive',  desc: 'Partner opted out or not available' },
                  { s: 'banned',    desc: 'Permanently removed from the platform' },
                ].map(({ s, desc }) => (
                  <p key={s} className={`text-[11px] ${editForm.status === s ? 'text-[#2D2D2D] font-medium' : 'text-[#bdbdbd]'}`}>
                    <span className={`font-semibold ${STATUS_STYLES[s].text}`}>{STATUS_STYLES[s].label}:</span> {desc}
                  </p>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F9F9F9]">
                <button
                  onClick={() => { setEditTarget(null); setEditForm(null); }}
                  className="px-4 py-2 text-sm font-medium text-[#757575] hover:bg-[#F9F9F9] rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-50"
                  style={{ backgroundColor: 'var(--primary)' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--primary-dark)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--primary)')}
                >
                  <Save size={14} />
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Partner Modal ── */}
      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => { setAddOpen(false); setAddForm(BLANK_ADD); }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0E0E0]">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}
                >
                  <UserPlus size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#2D2D2D]">Add New Partner</h2>
                  <p className="text-xs text-[#757575]">Create a partner account directly from admin</p>
                </div>
              </div>
              <button
                onClick={() => { setAddOpen(false); setAddForm(BLANK_ADD); }}
                className="p-1.5 text-[#757575] hover:bg-[#F9F9F9] rounded-lg transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">

              {/* ── Basic Info ── */}
              <div>
                <p className="text-[11px] font-semibold text-[#757575] uppercase tracking-wider mb-3">Basic Information</p>
                <div className="grid grid-cols-2 gap-3">
                  {/* Phone — required */}
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-medium text-[#2D2D2D] mb-1.5">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#757575]" />
                      <input
                        type="tel"
                        value={addForm.phone}
                        onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="10-digit mobile number"
                        maxLength={15}
                        className="w-full pl-9 pr-3 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#bdbdbd] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {/* Name */}
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-medium text-[#2D2D2D] mb-1.5">Full Name</label>
                    <input
                      type="text"
                      value={addForm.name}
                      onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full px-3 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#bdbdbd] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                    />
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="block text-xs font-medium text-[#2D2D2D] mb-1.5">Gender</label>
                    <select
                      value={addForm.gender}
                      onChange={e => setAddForm(f => ({ ...f, gender: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all bg-white"
                    >
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Language */}
                  <div>
                    <label className="block text-xs font-medium text-[#2D2D2D] mb-1.5">Language</label>
                    <input
                      type="text"
                      value={addForm.language}
                      onChange={e => setAddForm(f => ({ ...f, language: e.target.value }))}
                      placeholder="e.g. Hindi, English"
                      className="w-full px-3 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#bdbdbd] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* ── Work Details ── */}
              <div>
                <p className="text-[11px] font-semibold text-[#757575] uppercase tracking-wider mb-3">Work Details</p>
                <div className="grid grid-cols-2 gap-3">
                  {/* Team Option */}
                  <div>
                    <label className="block text-xs font-medium text-[#2D2D2D] mb-1.5">Works in Team?</label>
                    <select
                      value={addForm.team_option}
                      onChange={e => setAddForm(f => ({ ...f, team_option: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all bg-white"
                    >
                      <option value="">Select</option>
                      <option value="yes">Yes</option>
                      <option value="no">No (Solo)</option>
                    </select>
                  </div>

                  {/* Vehicle Type */}
                  <div>
                    <label className="block text-xs font-medium text-[#2D2D2D] mb-1.5">Vehicle Type</label>
                    <input
                      type="text"
                      value={addForm.vehicle_type}
                      onChange={e => setAddForm(f => ({ ...f, vehicle_type: e.target.value }))}
                      placeholder="Bike / Car / None"
                      className="w-full px-3 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#bdbdbd] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* ── Service Categories ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-semibold text-[#757575] uppercase tracking-wider">Service Categories</p>
                  {addForm.categories.length > 0 && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--light-purple)', color: 'var(--primary)' }}>
                      {addForm.categories.length} selected
                    </span>
                  )}
                </div>
                {categoryOptions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {categoryOptions.map(cat => {
                      const selected = addForm.categories.includes(cat.name);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => toggleAddCategory(cat.name)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                            selected
                              ? 'text-white border-transparent'
                              : 'bg-white text-[#757575] border-[#E0E0E0] hover:border-[var(--primary)] hover:text-[var(--primary)]'
                          }`}
                          style={selected ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' } : {}}
                        >
                          {selected && <CheckCircle size={11} />}
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-[#F9F9F9] rounded-xl">
                    <Tag size={13} className="text-[#bdbdbd]" />
                    <p className="text-xs text-[#757575]">No active categories found</p>
                  </div>
                )}
              </div>

              {/* ── Initial Status ── */}
              <div>
                <p className="text-[11px] font-semibold text-[#757575] uppercase tracking-wider mb-3">Initial Status</p>
                <div className="grid grid-cols-3 gap-2">
                  {ALL_STATUSES.map(s => {
                    const sst = STATUS_STYLES[s];
                    const isSelected = addForm.status === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setAddForm(f => ({ ...f, status: s }))}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                          isSelected
                            ? `${sst.bg} ${sst.text} border-current shadow-sm`
                            : 'bg-white text-[#757575] border-[#E0E0E0] hover:bg-[#F9F9F9]'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sst.dot}`} />
                        {sst.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-[#757575] mt-2">
                  Default is <span className="font-semibold text-[#2E7D32]">Approved</span> — partner can start accepting jobs immediately.
                </p>
              </div>

              {/* ── Actions ── */}
              <div className="flex items-center justify-between pt-2 border-t border-[#F9F9F9]">
                <p className="text-[11px] text-[#757575]">
                  Partner can log in via OTP on their phone.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setAddOpen(false); setAddForm(BLANK_ADD); }}
                    className="px-4 py-2 text-sm font-medium text-[#757575] hover:bg-[#F9F9F9] rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddPartner}
                    disabled={addSaving || !addForm.phone.trim()}
                    className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'var(--primary)' }}
                    onMouseEnter={e => { if (!addSaving) e.currentTarget.style.backgroundColor = 'var(--primary-dark)'; }}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--primary)')}
                  >
                    <UserPlus size={14} />
                    {addSaving ? 'Adding…' : 'Add Partner'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </PermissionGuard>
  );
}
