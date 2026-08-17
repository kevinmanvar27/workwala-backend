'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Ticket, Pencil, Trash2, Loader2, Calendar,
  Users, Shield, Tag, BarChart3, Clock, Check, AlertTriangle,
  Percent, DollarSign, History, ToggleLeft, ToggleRight,
  MapPin, Handshake, Info, Zap, Activity, Eye,
  UserPlus, Repeat2, Star, User, UserCheck,
} from 'lucide-react';
import PermissionGuard from '@/components/admin/PermissionGuard';

// ─── Types ────────────────────────────────────────────────────────────────────

type CouponStatus = 'draft' | 'scheduled' | 'active' | 'expired' | 'deactivated' | 'exhausted';

interface Coupon {
  id: number;
  code: string;
  name: string;
  description: string | null;
  terms_conditions: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_value: number;
  max_discount_amount: number | null;
  max_total_usage: number | null;
  max_usage_per_user: number;
  current_usage: number;
  remaining_usage: number | null;
  once_per_order: number;
  combinable: number;
  starts_at: string;
  expires_at: string;
  status: CouponStatus;
  audience_type: string;
  applicable_categories: number[] | null;
  applicable_partners: number[] | null;
  applicable_cities: string[] | null;
  applicable_services: number[] | null;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

interface AuditLog {
  id: number;
  action: string;
  performed_by_name: string;
  changes: Record<string, { before: unknown; after: unknown }> | null;
  ip_address: string | null;
  created_at: string;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<CouponStatus, { dot: string; text: string; bg: string; border: string; label: string }> = {
  draft:       { dot: 'bg-[#9E9E9E]',  text: 'text-[#616161]',  bg: 'bg-[#F5F5F5]',  border: 'border-[#E0E0E0]', label: 'Draft'       },
  scheduled:   { dot: 'bg-blue-400',   text: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200',  label: 'Scheduled'   },
  active:      { dot: 'bg-[#43A047]',  text: 'text-[#2E7D32]',  bg: 'bg-green-50',   border: 'border-green-200', label: 'Active'      },
  expired:     { dot: 'bg-orange-400', text: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200',label: 'Expired'     },
  deactivated: { dot: 'bg-red-400',    text: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',   label: 'Deactivated' },
  exhausted:   { dot: 'bg-purple-400', text: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200',label: 'Exhausted'   },
};

function StatusBadge({ status }: { status: CouponStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Audience icon map ────────────────────────────────────────────────────────

const AUDIENCE_ICONS: Record<string, React.ReactNode> = {
  all:            <Users size={13} />,
  new_users:      <UserPlus size={13} />,
  existing_users: <Repeat2 size={13} />,
  first_time:     <Star size={13} />,
  specific_users: <User size={13} />,
  city:           <MapPin size={13} />,
  partner:        <Handshake size={13} />,
  user_type:      <UserCheck size={13} />,
};

// ─── Action color for audit log ───────────────────────────────────────────────

const ACTION_COLOR: Record<string, string> = {
  created:     '#2E7D32',
  updated:     '#4A2372',
  activated:   '#2E7D32',
  scheduled:   '#2563EB',
  deactivated: '#ef4444',
  expired:     '#D97706',
  used:        '#7C3AED',
  deleted:     '#ef4444',
};

// ─── Small reusable row ───────────────────────────────────────────────────────

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[#F5F5F5] last:border-0">
      <span className="text-xs font-semibold text-[#9E9E9E] uppercase tracking-wider flex-shrink-0">{label}</span>
      <span className={`text-sm text-right ${mono ? 'font-mono font-bold tracking-widest text-[#1A1A1A]' : 'font-medium text-[#1A1A1A]'}`}>
        {value}
      </span>
    </div>
  );
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────

function Card({ title, icon, children, action }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-[#F0F0F0] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--light-purple)' }}>
            <span style={{ color: 'var(--primary)' }}>{icon}</span>
          </div>
          <h2 className="text-sm font-bold text-[#1A1A1A]">{title}</h2>
        </div>
        {action}
      </div>
      <div className="px-6 py-4">{children}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CouponDetailPage() {
  const params   = useParams();
  const router   = useRouter();
  const couponId = params.id as string;

  const [coupon, setCoupon]       = useState<Coupon | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading]     = useState(true);
  const [toggling, setToggling]   = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'usage' | 'audit'>('details');

  const [usageStats, setUsageStats] = useState<{ total_uses: number; total_discount: number; unique_users: number } | null>(null);
  const [usages, setUsages]         = useState<any[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);

  // ── Fetch coupon ───────────────────────────────────────────────────────────

  const fetchCoupon = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/admin/coupons/${couponId}`);
      const data = await res.json();
      if (res.ok) {
        setCoupon(data.coupon);
        setAuditLogs(data.audit_logs || []);
      } else {
        toast.error(data.error || 'Coupon not found');
        router.push('/admin/coupons');
      }
    } catch {
      toast.error('Failed to load coupon');
    } finally {
      setLoading(false);
    }
  }, [couponId, router]);

  useEffect(() => { fetchCoupon(); }, [fetchCoupon]);

  // ── Fetch usage ────────────────────────────────────────────────────────────

  const fetchUsage = useCallback(async () => {
    if (!coupon) return;
    setUsageLoading(true);
    try {
      const res  = await fetch(`/api/admin/coupons/${couponId}/usage`);
      const data = await res.json();
      if (res.ok) { setUsages(data.usages || []); setUsageStats(data.stats); }
    } catch { toast.error('Failed to load usage'); }
    finally { setUsageLoading(false); }
  }, [coupon, couponId]);

  useEffect(() => {
    if (activeTab === 'usage') fetchUsage();
  }, [activeTab, fetchUsage]);

  // ── Toggle status ──────────────────────────────────────────────────────────

  const handleToggleStatus = async () => {
    if (!coupon) return;
    if (coupon.status === 'active') { setShowDeactivateConfirm(true); return; }
    setToggling(true);
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: coupon.id, status: 'active' }),
      });
      const data = await res.json();
      if (res.ok) { toast.success('Coupon activated'); fetchCoupon(); }
      else toast.error(data.error || 'Failed');
    } catch { toast.error('Failed'); }
    finally { setToggling(false); }
  };

  const confirmDeactivate = async () => {
    if (!coupon) return;
    setShowDeactivateConfirm(false);
    setToggling(true);
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: coupon.id, status: 'deactivated' }),
      });
      const data = await res.json();
      if (res.ok) { toast.success('Coupon deactivated'); fetchCoupon(); }
      else toast.error(data.error || 'Failed');
    } catch { toast.error('Failed'); }
    finally { setToggling(false); }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!coupon) return;
    if (!confirm(`Delete coupon "${coupon.code}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: coupon.id }),
      });
      const data = await res.json();
      if (res.ok) { toast.success('Coupon deleted'); router.push('/admin/coupons'); }
      else toast.error(data.error || 'Delete failed');
    } catch { toast.error('Delete failed'); }
    finally { setDeleting(false); }
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <PermissionGuard permission="coupons.view">
        <div className="p-6 lg:p-8 w-full animate-pulse space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 bg-[var(--light-purple)] rounded-xl" />
            <div className="space-y-2">
              <div className="h-6 bg-[var(--light-purple)] rounded-lg w-40" />
              <div className="h-3 bg-[var(--light-purple)] rounded w-56" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-[var(--light-purple)] rounded-2xl" />)}
          </div>
          <div className="flex gap-6">
            <div className="flex-1 space-y-4">
              <div className="h-48 bg-[var(--light-purple)] rounded-2xl" />
              <div className="h-40 bg-[var(--light-purple)] rounded-2xl" />
            </div>
            <div className="w-72 space-y-4">
              <div className="h-64 bg-[var(--light-purple)] rounded-2xl" />
            </div>
          </div>
        </div>
      </PermissionGuard>
    );
  }

  if (!coupon) return null;

  const usagePct = coupon.max_total_usage
    ? Math.min(100, (coupon.current_usage / coupon.max_total_usage) * 100)
    : null;

  const isEditable   = !['expired', 'exhausted'].includes(coupon.status);
  const canToggle    = ['active', 'deactivated', 'scheduled', 'draft'].includes(coupon.status);
  const canDelete    = coupon.status !== 'active';

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <PermissionGuard permission="coupons.view">
      <div className="p-6 lg:p-8 w-full">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/coupons')}
              className="p-2 text-[#757575] hover:text-[#1A1A1A] hover:bg-white rounded-xl border border-[#E8E8E8] transition-all flex-shrink-0"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-[#1A1A1A] font-mono tracking-widest">{coupon.code}</h1>
                <StatusBadge status={coupon.status} />
              </div>
              <p className="text-[#757575] text-sm mt-0.5">{coupon.name}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isEditable && (
              <Link
                href={`/admin/coupons/${coupon.id}/edit`}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border border-[#E8E8E8] bg-white text-[#757575] hover:bg-[#F9F9F9] transition-all"
              >
                <Pencil size={14} /> Edit
              </Link>
            )}
            {canToggle && (
              <button
                onClick={handleToggleStatus}
                disabled={toggling}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all disabled:opacity-60"
                style={coupon.status === 'active'
                  ? { backgroundColor: '#FEF2F2', color: '#ef4444', border: '1px solid #FECACA' }
                  : { backgroundColor: 'var(--light-purple)', color: 'var(--primary)', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)' }
                }
              >
                {toggling
                  ? <Loader2 size={14} className="animate-spin" />
                  : coupon.status === 'active' ? <ToggleRight size={14} /> : <ToggleLeft size={14} />
                }
                {coupon.status === 'active' ? 'Deactivate' : 'Activate'}
              </button>
            )}
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all disabled:opacity-60"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete
              </button>
            )}
          </div>
        </div>

        {/* ── Stats strip ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            {
              label: 'Total Uses',
              value: coupon.current_usage,
              sub: coupon.max_total_usage ? `of ${coupon.max_total_usage} limit` : 'unlimited',
              icon: <BarChart3 size={15} />,
              color: 'var(--primary)',
              lightBg: 'var(--light-purple)',
            },
            {
              label: 'Remaining',
              value: coupon.remaining_usage ?? '∞',
              sub: 'uses left',
              icon: <Shield size={15} />,
              color: '#2E7D32',
              lightBg: '#F0FDF4',
            },
            {
              label: 'Per User',
              value: coupon.max_usage_per_user,
              sub: 'max uses / user',
              icon: <Users size={15} />,
              color: '#7C3AED',
              lightBg: '#FAF5FF',
            },
            {
              label: 'Discount',
              value: coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `₹${coupon.discount_value}`,
              sub: coupon.max_discount_amount ? `max ₹${coupon.max_discount_amount}` : 'no cap',
              icon: coupon.discount_type === 'percentage' ? <Percent size={15} /> : <DollarSign size={15} />,
              color: 'var(--accent)',
              lightBg: 'color-mix(in srgb, var(--accent) 10%, white)',
            },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl border border-[#E8E8E8] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold text-[#9E9E9E] uppercase tracking-wider">{stat.label}</p>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: stat.lightBg }}>
                  <span style={{ color: stat.color }}>{stat.icon}</span>
                </div>
              </div>
              <p className="text-2xl font-bold text-[#1A1A1A] leading-none">{stat.value}</p>
              <p className="text-[11px] text-[#BDBDBD] mt-1.5">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Usage progress bar */}
        {usagePct !== null && (
          <div className="bg-white rounded-2xl border border-[#E8E8E8] px-6 py-4 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-[#9E9E9E] uppercase tracking-wider">Usage Progress</p>
              <p className="text-xs font-bold text-[#1A1A1A]">{coupon.current_usage} / {coupon.max_total_usage} uses</p>
            </div>
            <div className="h-2.5 bg-[#F0F0F0] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${usagePct}%`,
                  backgroundColor: usagePct >= 90 ? '#ef4444' : usagePct >= 70 ? '#D97706' : 'var(--primary)',
                }}
              />
            </div>
            <p className="text-[11px] text-[#BDBDBD] mt-1.5">{usagePct.toFixed(1)}% consumed</p>
          </div>
        )}

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 p-1 rounded-xl mb-6 w-fit border border-[#E8E8E8] bg-[#F9F9F9]">
          {([
            { key: 'details', label: 'Details',       icon: <Info size={13} /> },
            { key: 'usage',   label: 'Usage History', icon: <Activity size={13} /> },
            { key: 'audit',   label: 'Audit Log',     icon: <History size={13} /> },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={activeTab === tab.key
                ? { backgroundColor: 'white', color: 'var(--primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                : { color: '#9E9E9E' }
              }
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Details Tab ─────────────────────────────────────────────────── */}
        {activeTab === 'details' && (
          <div className="flex flex-col xl:flex-row gap-6 items-start">

            {/* Left: main detail cards */}
            <div className="flex-1 min-w-0 space-y-5">

              {/* Coupon Info */}
              <Card title="Coupon Information" icon={<Ticket size={14} />}>
                <Row label="Code"          value={coupon.code} mono />
                <Row label="Name"          value={coupon.name} />
                {coupon.description && <Row label="Description" value={coupon.description} />}
                <Row label="Discount Type" value={
                  <span className="capitalize inline-flex items-center gap-1.5">
                    {coupon.discount_type === 'percentage' ? <Percent size={12} /> : <DollarSign size={12} />}
                    {coupon.discount_type}
                  </span>
                } />
                <Row label="Discount Value" value={
                  coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `₹${coupon.discount_value}`
                } />
                {coupon.min_order_value > 0 && <Row label="Min. Order Value" value={`₹${coupon.min_order_value}`} />}
                {coupon.max_discount_amount && <Row label="Max Discount Cap" value={`₹${coupon.max_discount_amount}`} />}
                {coupon.terms_conditions && (
                  <Row label="Terms & Conditions" value={
                    <span className="text-xs text-[#757575] italic leading-relaxed">{coupon.terms_conditions}</span>
                  } />
                )}
              </Card>

              {/* Usage Restrictions */}
              <Card title="Usage Restrictions" icon={<Shield size={14} />}>
                <Row label="Total Usage Limit" value={coupon.max_total_usage ?? 'Unlimited'} />
                <Row label="Per User Limit"    value={coupon.max_usage_per_user} />
                <Row label="Once Per Order"    value={
                  coupon.once_per_order
                    ? <span className="inline-flex items-center gap-1 text-[#2E7D32] font-semibold"><Check size={12} /> Yes</span>
                    : <span className="text-[#9E9E9E]">No</span>
                } />
                <Row label="Combinable" value={
                  coupon.combinable
                    ? <span className="inline-flex items-center gap-1 text-[#2E7D32] font-semibold"><Check size={12} /> Yes</span>
                    : <span className="text-[#9E9E9E]">No</span>
                } />
              </Card>

              {/* Target Audience & Applicability */}
              <Card title="Target Audience & Applicability" icon={<Users size={14} />}>
                <Row label="Audience Type" value={
                  <span className="inline-flex items-center gap-1.5 capitalize">
                    <span style={{ color: 'var(--primary)' }}>{AUDIENCE_ICONS[coupon.audience_type] ?? <Users size={13} />}</span>
                    {coupon.audience_type.replace(/_/g, ' ')}
                  </span>
                } />
                <Row label="Categories" value={
                  coupon.applicable_categories?.length
                    ? <span className="text-xs">IDs: {coupon.applicable_categories.join(', ')}</span>
                    : <span className="text-[#9E9E9E] text-xs">All categories</span>
                } />
                <Row label="Partners" value={
                  coupon.applicable_partners?.length
                    ? <span className="text-xs">IDs: {coupon.applicable_partners.join(', ')}</span>
                    : <span className="text-[#9E9E9E] text-xs">All partners</span>
                } />
                <Row label="Cities" value={
                  coupon.applicable_cities?.length
                    ? <span className="flex flex-wrap gap-1 justify-end">
                        {coupon.applicable_cities.map((c) => (
                          <span key={c} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F0F0F0] text-[#616161]">
                            <MapPin size={9} />{c}
                          </span>
                        ))}
                      </span>
                    : <span className="text-[#9E9E9E] text-xs">All cities</span>
                } />
              </Card>
            </div>

            {/* Right: sticky sidebar */}
            <div className="w-full xl:w-72 flex-shrink-0 space-y-5 xl:sticky xl:top-6">

              {/* Coupon card */}
              <div className="rounded-2xl overflow-hidden shadow-sm border border-[#E8E8E8]">
                <div className="px-5 py-5" style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <Ticket size={18} className="text-white" />
                    </div>
                    <div>
                      <p className="text-white font-mono font-bold text-lg tracking-widest leading-none">{coupon.code}</p>
                      <p className="text-white/70 text-xs mt-0.5 truncate max-w-[160px]">{coupon.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={coupon.status} />
                  </div>
                </div>

                <div className="bg-white px-5 py-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#9E9E9E] text-xs">Discount</span>
                    <span className="font-bold text-[#1A1A1A]">
                      {coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `₹${coupon.discount_value}`}
                    </span>
                  </div>
                  {coupon.min_order_value > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#9E9E9E] text-xs">Min. Order</span>
                      <span className="font-bold text-[#1A1A1A]">₹{coupon.min_order_value}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#9E9E9E] text-xs">Usage</span>
                    <span className="font-bold text-[#1A1A1A]">
                      {coupon.current_usage} / {coupon.max_total_usage ?? '∞'}
                    </span>
                  </div>
                  <div className="pt-3 border-t border-[#F0F0F0] space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#BDBDBD] flex items-center gap-1"><Calendar size={10} /> From</span>
                      <span className="font-semibold text-[#1A1A1A]">
                        {new Date(coupon.starts_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#BDBDBD] flex items-center gap-1"><Clock size={10} /> Until</span>
                      <span className="font-semibold text-[#1A1A1A]">
                        {new Date(coupon.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Scheduling card */}
              <Card title="Scheduling" icon={<Calendar size={14} />}>
                <Row label="Status"       value={<StatusBadge status={coupon.status} />} />
                <Row label="Starts At"    value={new Date(coupon.starts_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })} />
                <Row label="Expires At"   value={new Date(coupon.expires_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })} />
                <Row label="Created By"   value={coupon.created_by_name || '—'} />
                <Row label="Created"      value={new Date(coupon.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })} />
                <Row label="Last Updated" value={new Date(coupon.updated_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })} />
              </Card>

              {/* Quick actions */}
              {(isEditable || canToggle || canDelete) && (
                <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-sm p-5 space-y-2.5">
                  <p className="text-[11px] font-bold text-[#9E9E9E] uppercase tracking-wider mb-3">Quick Actions</p>
                  {isEditable && (
                    <Link
                      href={`/admin/coupons/${coupon.id}/edit`}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#E8E8E8] text-sm font-semibold text-[#757575] hover:bg-[#F9F9F9] transition-all"
                    >
                      <Pencil size={14} /> Edit Coupon
                    </Link>
                  )}
                  {canToggle && (
                    <button
                      onClick={handleToggleStatus}
                      disabled={toggling}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
                      style={coupon.status === 'active'
                        ? { backgroundColor: '#FEF2F2', color: '#ef4444', border: '1px solid #FECACA' }
                        : { backgroundColor: 'var(--light-purple)', color: 'var(--primary)', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)' }
                      }
                    >
                      {toggling
                        ? <Loader2 size={14} className="animate-spin" />
                        : coupon.status === 'active' ? <ToggleRight size={14} /> : <Zap size={14} />
                      }
                      {coupon.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all disabled:opacity-60"
                    >
                      {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      Delete Coupon
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Usage History Tab ────────────────────────────────────────────── */}
        {activeTab === 'usage' && (
          <div className="space-y-5">

            {/* Stats */}
            {usageStats && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Total Uses',     value: usageStats.total_uses,                                      icon: <BarChart3 size={15} />, color: 'var(--primary)', bg: 'var(--light-purple)' },
                  { label: 'Total Discount', value: `₹${Number(usageStats.total_discount).toFixed(2)}`,         icon: <DollarSign size={15} />, color: '#2E7D32',        bg: '#F0FDF4' },
                  { label: 'Unique Users',   value: usageStats.unique_users,                                    icon: <Users size={15} />,     color: '#7C3AED',        bg: '#FAF5FF' },
                ].map((s) => (
                  <div key={s.label} className="bg-white rounded-2xl border border-[#E8E8E8] p-5 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: s.bg }}>
                      <span style={{ color: s.color }}>{s.icon}</span>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-[#9E9E9E] uppercase tracking-wider">{s.label}</p>
                      <p className="text-xl font-bold text-[#1A1A1A] mt-0.5">{s.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Usage table */}
            <div className="bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-[#F0F0F0] flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--light-purple)' }}>
                  <History size={14} style={{ color: 'var(--primary)' }} />
                </div>
                <h2 className="text-sm font-bold text-[#1A1A1A]">Usage Records</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#F0F0F0] bg-[#FAFAFA]">
                      {['User', 'Order ID', 'Order Amt', 'Discount', 'City', 'Date', 'Status'].map((h) => (
                        <th key={h} className="text-left text-[11px] font-bold text-[#9E9E9E] uppercase tracking-wider px-5 py-3 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {usageLoading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i} className="border-b border-[#F5F5F5]">
                          {[...Array(7)].map((_, j) => (
                            <td key={j} className="px-5 py-4">
                              <div className="h-3 bg-[var(--light-purple)] rounded animate-pulse" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : usages.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-16 text-center">
                          <div className="w-12 h-12 bg-[#F5F5F5] rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <History size={20} className="text-[#BDBDBD]" />
                          </div>
                          <p className="text-sm font-medium text-[#9E9E9E]">No usage recorded yet</p>
                        </td>
                      </tr>
                    ) : usages.map((u) => (
                      <tr key={u.id} className="border-b border-[#F5F5F5] last:border-0 hover:bg-[#FAFAFA] transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-semibold text-[#1A1A1A]">{u.customer_name || '—'}</p>
                          <p className="text-xs text-[#9E9E9E]">{u.customer_phone}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs font-mono text-[#9E9E9E]">#{u.order_id}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-sm font-semibold text-[#1A1A1A]">₹{Number(u.order_amount).toFixed(2)}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-sm font-bold text-[#2E7D32]">−₹{Number(u.discount_amount).toFixed(2)}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs text-[#9E9E9E]">{u.city || '—'}</span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="text-xs text-[#9E9E9E]">
                            {new Date(u.used_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            u.usage_status === 'applied'  ? 'bg-green-50 text-[#2E7D32]'
                            : u.usage_status === 'reversed' ? 'bg-orange-50 text-orange-700'
                            : 'bg-red-50 text-red-700'
                          }`}>
                            {u.usage_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Audit Log Tab ────────────────────────────────────────────────── */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-[#F0F0F0] flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--light-purple)' }}>
                <History size={14} style={{ color: 'var(--primary)' }} />
              </div>
              <h2 className="text-sm font-bold text-[#1A1A1A]">Audit Trail</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full ml-auto" style={{ backgroundColor: 'var(--light-purple)', color: 'var(--primary)' }}>
                {auditLogs.length} {auditLogs.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>

            {auditLogs.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 bg-[#F5F5F5] rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <History size={20} className="text-[#BDBDBD]" />
                </div>
                <p className="text-sm font-medium text-[#9E9E9E]">No audit logs yet</p>
              </div>
            ) : (
              <div className="divide-y divide-[#F5F5F5]">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-4 px-6 py-4 hover:bg-[#FAFAFA] transition-colors">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold mt-0.5"
                      style={{ backgroundColor: ACTION_COLOR[log.action] || '#9CA3AF' }}
                    >
                      {log.action.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-[#1A1A1A]">{log.performed_by_name || 'System'}</span>
                        <span
                          className="text-[11px] font-bold capitalize px-2 py-0.5 rounded-full"
                          style={{
                            color: ACTION_COLOR[log.action] || '#9CA3AF',
                            backgroundColor: `${ACTION_COLOR[log.action]}18` || '#F5F5F5',
                          }}
                        >
                          {log.action}
                        </span>
                      </div>
                      {log.changes && Object.keys(log.changes).length > 0 && (
                        <div className="mt-2 space-y-1">
                          {Object.entries(log.changes).slice(0, 3).map(([key, change]) => (
                            <p key={key} className="text-[11px] text-[#9E9E9E]">
                              <span className="font-semibold capitalize text-[#616161]">{key.replace(/_/g, ' ')}</span>:{' '}
                              <span className="line-through text-red-400">{String(change.before)}</span>
                              {' → '}
                              <span className="text-[#2E7D32] font-medium">{String(change.after)}</span>
                            </p>
                          ))}
                        </div>
                      )}
                      <p className="text-[11px] text-[#BDBDBD] mt-1.5">
                        {new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}
                        {log.ip_address && <span className="ml-2 font-mono">{log.ip_address}</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Deactivate Confirmation Modal ────────────────────────────────────── */}
      {showDeactivateConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowDeactivateConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-6 text-center">
              <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={24} className="text-red-500" />
              </div>
              <h3 className="text-base font-bold text-[#1A1A1A] mb-2">Deactivate Coupon?</h3>
              <p className="text-sm text-[#757575] leading-relaxed">
                Deactivating <span className="font-mono font-bold text-[#1A1A1A]">{coupon.code}</span> will immediately
                prevent users from applying it. You can re-activate it at any time.
              </p>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setShowDeactivateConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-[#E8E8E8] rounded-xl text-sm font-semibold text-[#757575] hover:bg-[#F9F9F9] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeactivate}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-all"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </PermissionGuard>
  );
}
