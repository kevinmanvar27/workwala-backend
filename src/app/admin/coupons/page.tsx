'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Plus, Search, Ticket, ChevronLeft, ChevronRight,
  Filter, ArrowUpDown, Eye, Pencil, Trash2, Loader2,
  ToggleLeft, ToggleRight, RefreshCw, BarChart3,
  Tag, Calendar, Users, Percent, DollarSign, X,
} from 'lucide-react';
import PermissionGuard from '@/components/admin/PermissionGuard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CouponRow {
  id: number;
  code: string;
  name: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_value: number;
  max_discount_amount: number | null;
  max_total_usage: number | null;
  current_usage: number;
  status: CouponStatus;
  starts_at: string;
  expires_at: string;
  audience_type: string;
  applicable_categories: number[] | null;
  created_by_name: string;
  created_at: string;
}

type CouponStatus = 'draft' | 'scheduled' | 'active' | 'expired' | 'deactivated' | 'exhausted';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<CouponStatus, { dot: string; text: string; bg: string; label: string }> = {
  draft:       { dot: 'bg-[#757575]',  text: 'text-[#757575]',  bg: 'bg-[#F9F9F9]',  label: 'Draft'       },
  scheduled:   { dot: 'bg-blue-500',   text: 'text-blue-700',   bg: 'bg-blue-50',    label: 'Scheduled'   },
  active:      { dot: 'bg-[#2E7D32]',  text: 'text-[#2E7D32]',  bg: 'bg-green-50',   label: 'Active'      },
  expired:     { dot: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50',  label: 'Expired'     },
  deactivated: { dot: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50',     label: 'Deactivated' },
  exhausted:   { dot: 'bg-purple-500', text: 'text-purple-700', bg: 'bg-purple-50',  label: 'Exhausted'   },
};

const ALL_STATUSES: CouponStatus[] = ['draft', 'scheduled', 'active', 'expired', 'deactivated', 'exhausted'];

function StatusBadge({ status }: { status: CouponStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function DiscountBadge({ type, value, max }: { type: string; value: number; max: number | null }) {
  return (
    <div className="flex items-center gap-1">
      {type === 'percentage'
        ? <span className="inline-flex items-center gap-0.5 text-sm font-bold text-[#2D2D2D]"><Percent size={12} className="text-[var(--primary)]" />{value}%</span>
        : <span className="inline-flex items-center gap-0.5 text-sm font-bold text-[#2D2D2D]"><DollarSign size={12} className="text-[var(--primary)]" />₹{value}</span>
      }
      {max && <span className="text-[10px] text-[#757575]">(max ₹{max})</span>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CouponsPage() {
  const [coupons, setCoupons]   = useState<CouponRow[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);

  // Filters
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort]         = useState('created_at');
  const [dir, setDir]           = useState<'asc' | 'desc'>('desc');
  const [page, setPage]         = useState(1);
  const limit = 15;

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search, status: statusFilter, sort, dir,
        page: String(page), limit: String(limit),
      });
      const res  = await fetch(`/api/admin/coupons?${params}`);
      const data = await res.json();
      if (res.ok) {
        setCoupons(data.coupons);
        setTotal(data.total);
      } else {
        toast.error(data.error || 'Failed to load coupons');
      }
    } catch {
      toast.error('Failed to load coupons');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sort, dir, page]);

  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

  // Reset page on filter change
  const applyFilter = (fn: () => void) => { fn(); setPage(1); };

  // ── Toggle sort ────────────────────────────────────────────────────────────

  const toggleSort = (col: string) => {
    if (sort === col) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSort(col); setDir('desc'); }
    setPage(1);
  };

  // ── Toggle status (activate / deactivate) ─────────────────────────────────

  const handleToggleStatus = async (coupon: CouponRow) => {
    const newStatus = coupon.status === 'active' ? 'deactivated' : 'active';
    if (newStatus === 'deactivated') {
      if (!confirm(`Deactivate coupon "${coupon.code}"? Users will no longer be able to apply it.`)) return;
    }
    setToggling(coupon.id);
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: coupon.id, status: newStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(newStatus === 'active' ? 'Coupon activated' : 'Coupon deactivated');
        fetchCoupons();
      } else {
        toast.error(data.error || 'Failed to update status');
      }
    } catch {
      toast.error('Failed to update status');
    } finally {
      setToggling(null);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async (coupon: CouponRow) => {
    if (!confirm(`Delete coupon "${coupon.code}"? This cannot be undone.`)) return;
    setDeleting(coupon.id);
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: coupon.id }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Coupon deleted');
        fetchCoupons();
      } else {
        toast.error(data.error || 'Delete failed');
      }
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <PermissionGuard permission="coupons.view">
      <div className="p-6 lg:p-8 w-full">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#2D2D2D] tracking-tight">Coupon Codes</h1>
            <p className="text-[#757575] text-sm mt-1">
              {total} coupon{total !== 1 ? 's' : ''} · manage discounts and promotions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/coupons/analytics"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border border-[#E0E0E0] bg-white text-[#757575] hover:bg-[#F9F9F9] transition-all"
            >
              <BarChart3 size={15} />
              Analytics
            </Link>
            <Link
              href="/admin/coupons/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-xl transition-all hover:opacity-90 shadow-sm"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              <Plus size={15} />
              Create Coupon
            </Link>
          </div>
        </div>

        {/* ── Filters ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#757575]" />
            <input
              type="text"
              placeholder="Search by code or name…"
              value={search}
              onChange={(e) => applyFilter(() => setSearch(e.target.value))}
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#757575] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
            />
            {search && (
              <button onClick={() => applyFilter(() => setSearch(''))} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#757575] hover:text-[#2D2D2D]">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1 bg-[var(--light-purple)] p-1 rounded-xl flex-shrink-0 flex-wrap">
            <button
              onClick={() => applyFilter(() => setStatusFilter('all'))}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={statusFilter === 'all' ? { backgroundColor: 'white', color: 'var(--primary)', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' } : { color: '#757575' }}
            >
              All
            </button>
            {ALL_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => applyFilter(() => setStatusFilter(s))}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize"
                style={statusFilter === s ? { backgroundColor: 'white', color: 'var(--primary)', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' } : { color: '#757575' }}
              >
                {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={fetchCoupons}
            disabled={loading}
            className="p-2.5 bg-white border border-[#E0E0E0] rounded-xl text-[#757575] hover:bg-[#F9F9F9] transition-all flex-shrink-0"
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* ── Table ───────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-[#E0E0E0] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E0E0E0] bg-[#FAFAFA]">
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-5 py-3.5">Code / Name</th>
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-5 py-3.5">Discount</th>
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-5 py-3.5 hidden md:table-cell">Audience</th>
                  <th
                    className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-5 py-3.5 hidden lg:table-cell cursor-pointer select-none"
                    onClick={() => toggleSort('current_usage')}
                  >
                    <span className="inline-flex items-center gap-1">Usage <ArrowUpDown size={10} /></span>
                  </th>
                  <th
                    className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-5 py-3.5 hidden lg:table-cell cursor-pointer select-none"
                    onClick={() => toggleSort('expires_at')}
                  >
                    <span className="inline-flex items-center gap-1">Validity <ArrowUpDown size={10} /></span>
                  </th>
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-5 py-3.5">Status</th>
                  <th className="text-right text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-5 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i} className="border-b border-[#F9F9F9]">
                      {[...Array(7)].map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="h-3 bg-[var(--light-purple)] rounded animate-pulse" style={{ width: `${60 + j * 10}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : coupons.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-20 text-center">
                      <div className="w-14 h-14 bg-[var(--light-purple)] rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Ticket size={24} style={{ color: 'var(--primary)' }} />
                      </div>
                      <p className="text-[#757575] font-medium text-sm">No coupons found</p>
                      <p className="text-[#bdbdbd] text-xs mt-1">
                        {search || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Click "Create Coupon" to get started'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  coupons.map((coupon) => (
                    <tr key={coupon.id} className="border-b border-[#F9F9F9] last:border-0 hover:bg-[#FAFAFA] transition-colors">

                      {/* Code / Name */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: 'var(--light-purple)' }}
                          >
                            <Ticket size={16} style={{ color: 'var(--primary)' }} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#2D2D2D] font-mono tracking-wide">{coupon.code}</p>
                            <p className="text-xs text-[#757575] truncate max-w-[160px]">{coupon.name}</p>
                          </div>
                        </div>
                      </td>

                      {/* Discount */}
                      <td className="px-5 py-4">
                        <DiscountBadge type={coupon.discount_type} value={coupon.discount_value} max={coupon.max_discount_amount} />
                        {coupon.min_order_value > 0 && (
                          <p className="text-[10px] text-[#bdbdbd] mt-0.5">Min ₹{coupon.min_order_value}</p>
                        )}
                      </td>

                      {/* Audience */}
                      <td className="px-5 py-4 hidden md:table-cell">
                        <span className="inline-flex items-center gap-1.5 text-xs text-[#757575] bg-[#F9F9F9] px-2.5 py-1 rounded-lg capitalize">
                          <Users size={11} />
                          {coupon.audience_type.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Usage */}
                      <td className="px-5 py-4 hidden lg:table-cell">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-[#2D2D2D]">{coupon.current_usage}</span>
                          {coupon.max_total_usage && (
                            <>
                              <span className="text-[#bdbdbd]">/</span>
                              <span className="text-xs text-[#757575]">{coupon.max_total_usage}</span>
                            </>
                          )}
                        </div>
                        {coupon.max_total_usage && (
                          <div className="mt-1 h-1 bg-[#F0F0F0] rounded-full w-16 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, (coupon.current_usage / coupon.max_total_usage) * 100)}%`,
                                backgroundColor: coupon.current_usage >= coupon.max_total_usage ? '#ef4444' : 'var(--primary)',
                              }}
                            />
                          </div>
                        )}
                      </td>

                      {/* Validity */}
                      <td className="px-5 py-4 hidden lg:table-cell">
                        <div className="flex items-center gap-1 text-xs text-[#757575]">
                          <Calendar size={11} />
                          <span>{new Date(coupon.starts_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })}</span>
                          <span className="text-[#bdbdbd]">–</span>
                          <span>{new Date(coupon.expires_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'Asia/Kolkata' })}</span>
                        </div>
                        <p className="text-[10px] text-[#bdbdbd] mt-0.5">by {coupon.created_by_name || '—'}</p>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <StatusBadge status={coupon.status} />
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {/* View */}
                          <Link
                            href={`/admin/coupons/${coupon.id}`}
                            className="p-2 text-[#757575] hover:bg-[var(--light-purple)] rounded-lg transition-all"
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = '#757575')}
                            title="View details"
                          >
                            <Eye size={14} />
                          </Link>

                          {/* Edit */}
                          {!['expired', 'exhausted'].includes(coupon.status) && (
                            <Link
                              href={`/admin/coupons/${coupon.id}/edit`}
                              className="p-2 text-[#757575] hover:bg-[var(--light-purple)] rounded-lg transition-all"
                              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary)')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = '#757575')}
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </Link>
                          )}

                          {/* Toggle active/deactivate */}
                          {(coupon.status === 'active' || coupon.status === 'deactivated' || coupon.status === 'scheduled') && (
                            <button
                              onClick={() => handleToggleStatus(coupon)}
                              disabled={toggling === coupon.id}
                              className="p-2 text-[#757575] hover:bg-[var(--light-purple)] rounded-lg transition-all disabled:opacity-40"
                              title={coupon.status === 'active' ? 'Deactivate' : 'Activate'}
                            >
                              {toggling === coupon.id
                                ? <Loader2 size={14} className="animate-spin" />
                                : coupon.status === 'active'
                                  ? <ToggleRight size={14} className="text-[#2E7D32]" />
                                  : <ToggleLeft size={14} />
                              }
                            </button>
                          )}

                          {/* Delete */}
                          {coupon.status !== 'active' && (
                            <button
                              onClick={() => handleDelete(coupon)}
                              disabled={deleting === coupon.id}
                              className="p-2 text-[#757575] hover:bg-red-50 hover:text-red-600 rounded-lg transition-all disabled:opacity-40"
                              title="Delete"
                            >
                              {deleting === coupon.id
                                ? <Loader2 size={14} className="animate-spin" />
                                : <Trash2 size={14} />
                              }
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ──────────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#E0E0E0] bg-[#FAFAFA]">
              <p className="text-xs text-[#757575]">
                Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-[#E0E0E0] text-[#757575] hover:bg-white disabled:opacity-40 transition-all"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className="w-8 h-8 rounded-lg text-xs font-medium transition-all"
                      style={p === page
                        ? { backgroundColor: 'var(--primary)', color: 'white' }
                        : { border: '1px solid #E0E0E0', color: '#757575', backgroundColor: 'white' }
                      }
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-[#E0E0E0] text-[#757575] hover:bg-white disabled:opacity-40 transition-all"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PermissionGuard>
  );
}
