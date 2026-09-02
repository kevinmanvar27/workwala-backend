'use client';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Search, Users, ChevronLeft, ChevronRight, Inbox,
  Phone, Eye, X, Pencil, Save, RotateCcw, Trash2,
  UserPlus, ShoppingBag,
} from 'lucide-react';
import PermissionGuard from '@/components/admin/PermissionGuard';
import { apiFetch } from '@/lib/apiFetch';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CustomerRow {
  id: number;
  name: string | null;
  phone: string;
  fcm_token: string | null;
  created_at: string;
  deleted_at: string | null;
  total_bookings: number;
}

interface EditForm {
  name: string;
  phone: string;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [tab, setTab]             = useState<'active' | 'deleted'>('active');
  const [loading, setLoading]     = useState(true);

  // Preview modal
  const [preview, setPreview] = useState<CustomerRow | null>(null);

  // Edit modal
  const [editTarget, setEditTarget] = useState<CustomerRow | null>(null);
  const [editForm, setEditForm]     = useState<EditForm | null>(null);
  const [saving, setSaving]         = useState(false);

  // Acting (delete / restore spinner)
  const [acting, setActing] = useState<number | null>(null);

  const limit = 10;

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/customers?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&deleted=${tab === 'deleted' ? '1' : '0'}`
      );
      const data = await res.json();
      if (res.ok) { setCustomers(data.customers); setTotal(data.total); }
      else toast.error(data.error || 'Failed to load customers');
    } catch { toast.error('Failed to load customers'); }
    finally { setLoading(false); }
  }, [page, search, tab]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const switchTab = (t: 'active' | 'deleted') => { setTab(t); setPage(1); setSearch(''); };

  // ── Edit ───────────────────────────────────────────────────────────────────

  const openEdit = (c: CustomerRow) => {
    setEditTarget(c);
    setEditForm({ name: c.name || '', phone: c.phone || '' });
  };

  const handleSaveEdit = async () => {
    if (!editTarget || !editForm) return;
    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editTarget.id, action: 'edit', name: editForm.name, phone: editForm.phone }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Customer updated');
        setEditTarget(null);
        setEditForm(null);
        if (preview?.id === editTarget.id) setPreview(null);
        fetchCustomers();
      } else {
        toast.error(data.error || 'Failed to save');
      }
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  // ── Delete / Restore ───────────────────────────────────────────────────────

  const handleDelete = async (c: CustomerRow) => {
    if (!confirm(`Soft-delete customer "${c.name || c.phone}"? They can be restored later.`)) return;
    setActing(c.id);
    try {
      const res = await apiFetch('/api/admin/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, action: 'delete' }),
      });
      const data = await res.json();
      if (res.ok) { toast.success('Customer removed'); setPreview(null); fetchCustomers(); }
      else toast.error(data.error || 'Failed to delete');
    } catch { toast.error('Failed to delete'); }
    finally { setActing(null); }
  };

  const handleRestore = async (c: CustomerRow) => {
    if (!confirm(`Restore customer "${c.name || c.phone}"?`)) return;
    setActing(c.id);
    try {
      const res = await apiFetch('/api/admin/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, action: 'restore' }),
      });
      const data = await res.json();
      if (res.ok) { toast.success('Customer restored'); fetchCustomers(); }
      else toast.error(data.error || 'Failed to restore');
    } catch { toast.error('Failed to restore'); }
    finally { setActing(null); }
  };

  const totalPages = Math.ceil(total / limit);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <PermissionGuard permission="users.view">
      <div className="p-6 lg:p-8 w-full">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#2D2D2D] tracking-tight">Customers</h1>
            <p className="text-[#757575] text-sm mt-1">
              {total} {tab === 'deleted' ? 'deleted' : 'total'} customers
            </p>
          </div>
        </div>

        {/* ── Tabs + Search ── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <div className="flex items-center gap-1 bg-[var(--light-purple)] p-1 rounded-xl flex-shrink-0">
            {(['active', 'deleted'] as const).map((t) => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize"
                style={tab === t
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

        {/* ── Table ── */}
        <div className="bg-white rounded-2xl border border-[#E0E0E0] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E0E0E0]">
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5 w-12">Sr.</th>
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5">Customer</th>
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5 hidden md:table-cell">Phone</th>
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5 hidden lg:table-cell">Bookings</th>
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5 hidden lg:table-cell">FCM</th>
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5 hidden lg:table-cell">Joined</th>
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
                      <td className="px-6 py-4 hidden lg:table-cell"><div className="h-3 bg-[var(--light-purple)] rounded w-12 animate-pulse" /></td>
                      <td className="px-6 py-4 hidden lg:table-cell"><div className="h-3 bg-[var(--light-purple)] rounded w-8 animate-pulse" /></td>
                      <td className="px-6 py-4 hidden lg:table-cell"><div className="h-3 bg-[var(--light-purple)] rounded w-20 animate-pulse" /></td>
                      <td className="px-6 py-4"><div className="h-7 bg-[var(--light-purple)] rounded w-20 ml-auto animate-pulse" /></td>
                    </tr>
                  ))
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="w-14 h-14 bg-[var(--light-purple)] rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Users size={24} style={{ color: 'var(--primary)' }} />
                      </div>
                      <p className="text-[#757575] font-medium text-sm">
                        No {tab === 'deleted' ? 'deleted ' : ''}customers found
                      </p>
                    </td>
                  </tr>
                ) : (
                  customers.map((customer, index) => {
                    const srNo = (page - 1) * limit + index + 1;
                    const initials = customer.name
                      ? customer.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
                      : customer.phone.slice(-2);
                    const hasFcm = !!customer.fcm_token;

                    return (
                      <tr key={customer.id} className="border-b border-[#F9F9F9] last:border-0 hover:bg-[#F9F9F9]/60 transition-colors">
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
                              <p className="text-sm font-semibold text-[#2D2D2D] leading-none">
                                {customer.name || <span className="text-[#bdbdbd]">—</span>}
                              </p>
                              <p className="text-xs text-[#757575] mt-0.5">ID #{customer.id}</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 hidden md:table-cell">
                          <a
                            href={`tel:${customer.phone}`}
                            className="inline-flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-70"
                            style={{ color: 'var(--primary)' }}
                            title={`Call ${customer.phone}`}
                          >
                            <Phone size={11} />
                            {customer.phone}
                          </a>
                        </td>

                        <td className="px-6 py-4 hidden lg:table-cell">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#2D2D2D]">
                            <ShoppingBag size={11} className="text-[#757575]" />
                            {customer.total_bookings}
                          </span>
                        </td>

                        <td className="px-6 py-4 hidden lg:table-cell">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${hasFcm ? 'bg-green-50 text-[#2E7D32]' : 'bg-[#F9F9F9] text-[#bdbdbd]'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${hasFcm ? 'bg-[#2E7D32]' : 'bg-[#bdbdbd]'}`} />
                            {hasFcm ? 'Active' : 'None'}
                          </span>
                        </td>

                        <td className="px-6 py-4 hidden lg:table-cell">
                          <span className="text-xs text-[#757575]">
                            {new Date(customer.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            {tab === 'active' ? (
                              <>
                                {/* View */}
                                <button
                                  onClick={() => setPreview(customer)}
                                  className="p-2 text-[#757575] hover:bg-[var(--light-purple)] rounded-lg transition-all"
                                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                                  onMouseLeave={e => (e.currentTarget.style.color = '#757575')}
                                  title="View details"
                                >
                                  <Eye size={14} />
                                </button>
                                {/* Edit */}
                                <button
                                  onClick={() => openEdit(customer)}
                                  className="p-2 text-[#757575] hover:bg-[var(--light-purple)] rounded-lg transition-all"
                                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                                  onMouseLeave={e => (e.currentTarget.style.color = '#757575')}
                                  title="Edit customer"
                                >
                                  <Pencil size={14} />
                                </button>
                                {/* Delete */}
                                <button
                                  onClick={() => handleDelete(customer)}
                                  disabled={acting === customer.id}
                                  className="p-2 text-[#757575] hover:bg-red-50 hover:text-red-600 rounded-lg transition-all disabled:opacity-40"
                                  title="Remove customer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            ) : (
                              /* Restore */
                              <button
                                onClick={() => handleRestore(customer)}
                                disabled={acting === customer.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#2E7D32] bg-green-50 hover:bg-green-100 rounded-lg transition-all disabled:opacity-50"
                              >
                                <RotateCcw size={12} />
                                Restore
                              </button>
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

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-[#F9F9F9] flex items-center justify-between">
              <p className="text-xs text-[#757575]">
                Showing{' '}
                <span className="font-medium text-[#2D2D2D]">
                  {(page - 1) * limit + 1}–{Math.min(page * limit, total)}
                </span>{' '}
                of <span className="font-medium text-[#2D2D2D]">{total}</span>
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

      {/* ── View / Preview Modal ── */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setPreview(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0E0E0]">
              <h2 className="text-base font-bold text-[#2D2D2D]">Customer Details</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setPreview(null); openEdit(preview); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
                  style={{ backgroundColor: 'var(--light-purple)', color: 'var(--primary)' }}
                >
                  <Pencil size={12} />
                  Edit
                </button>
                <button
                  onClick={() => setPreview(null)}
                  className="p-1.5 text-[#757575] hover:bg-[#F9F9F9] rounded-lg transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Avatar + name */}
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}
                >
                  {preview.name
                    ? preview.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
                    : preview.phone.slice(-2)}
                </div>
                <div>
                  <p className="text-base font-bold text-[#2D2D2D]">{preview.name || '—'}</p>
                  <a
                    href={`tel:${preview.phone}`}
                    className="inline-flex items-center gap-1 text-sm transition-opacity hover:opacity-70 mt-0.5"
                    style={{ color: 'var(--primary)' }}
                  >
                    <Phone size={12} />
                    {preview.phone}
                  </a>
                </div>
              </div>

              {/* Info grid */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-[#757575] uppercase tracking-wider">Details</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-[#757575] text-xs">Customer ID</span>
                    <p className="font-medium text-[#2D2D2D]">#{preview.id}</p>
                  </div>
                  <div>
                    <span className="text-[#757575] text-xs">Total Bookings</span>
                    <p className="font-medium text-[#2D2D2D]">{preview.total_bookings}</p>
                  </div>
                  <div>
                    <span className="text-[#757575] text-xs">Joined</span>
                    <p className="font-medium text-[#2D2D2D]">
                      {new Date(preview.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#757575] text-xs">Push Notifications</span>
                    <p className={`font-medium ${preview.fcm_token ? 'text-[#2E7D32]' : 'text-[#bdbdbd]'}`}>
                      {preview.fcm_token ? 'Enabled' : 'Not set'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F9F9F9]">
                <button
                  onClick={() => handleDelete(preview)}
                  disabled={acting === preview.id}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition-all disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editTarget && editForm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => { setEditTarget(null); setEditForm(null); }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0E0E0]">
              <div>
                <h2 className="text-base font-bold text-[#2D2D2D]">Edit Customer</h2>
                <p className="text-xs text-[#757575] mt-0.5">{editTarget.name || editTarget.phone}</p>
              </div>
              <button
                onClick={() => { setEditTarget(null); setEditForm(null); }}
                className="p-1.5 text-[#757575] hover:bg-[#F9F9F9] rounded-lg transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-[11px] font-semibold text-[#757575] uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => f ? { ...f, name: e.target.value } : f)}
                  placeholder="Customer name"
                  className="w-full px-3 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#bdbdbd] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-[11px] font-semibold text-[#757575] uppercase tracking-wider mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#757575]" />
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setEditForm((f) => f ? { ...f, phone: value } : f);
                    }}
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    pattern="[0-9]{10}"
                    className="w-full pl-9 pr-3 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#bdbdbd] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Actions */}
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
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--primary-dark)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--primary)')}
                >
                  <Save size={14} />
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PermissionGuard>
  );
}
