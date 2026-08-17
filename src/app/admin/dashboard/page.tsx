'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { Users, Shield, FileText, Trash2, Plus, ArrowUpRight, TrendingUp } from 'lucide-react';
import PermissionGuard from '@/components/admin/PermissionGuard';
import {
  ResponsiveContainer,
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────────────────────
interface DashboardData {
  stats: {
    totalUsers: number; activeUsers: number; totalRoles: number;
    totalPages: number; publishedPages: number; pendingDeleteRequests: number;
  };
  recentUsers: {
    id: number; name: string; email: string; role_name: string; status: string; created_at: string;
  }[];
}

interface DayCount    { day: string; count: number }
interface DayRevenue  { day: string; revenue: number }
interface StatusCount { status: string; count: number }
interface AnalyticsSummary { avgBookingValue: number; periodDays: number }
interface AnalyticsData {
  summary: AnalyticsSummary;
  bookingGrowth: DayCount[];
  customerGrowth: DayCount[];
  revenueGrowth: DayRevenue[];
  bookingsByStatus: StatusCount[];
  partnersByStatus: StatusCount[];
  customersByStatus: StatusCount[];
}

// ── CSS var resolver ───────────────────────────────────────────────────────────
function getCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
const FALLBACK_PRIMARY = '#4A2372';
const FALLBACK_ACCENT  = '#C2185B';

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDay(day: string) {
  return new Date(day + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}

function fillDays(data: DayCount[], days: number): DayCount[] {
  const map: Record<string, number> = {};
  data.forEach((d) => { map[d.day] = Number(d.count); });
  const result: DayCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d   = new Date();
    const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - i));
    const key = utc.toISOString().slice(0, 10);
    result.push({ day: key, count: map[key] ?? 0 });
  }
  return result;
}

function fillRevenueDays(data: DayRevenue[], days: number): DayRevenue[] {
  const map: Record<string, number> = {};
  data.forEach((d) => { map[d.day] = Number(d.revenue); });
  const result: DayRevenue[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d   = new Date();
    const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - i));
    const key = utc.toISOString().slice(0, 10);
    result.push({ day: key, revenue: map[key] ?? 0 });
  }
  return result;
}

// ── Tooltip ────────────────────────────────────────────────────────────────────
function ChartTip({ active, payload, label }: { active?: boolean; payload?: { color: string; name: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E8E8E8] rounded-md shadow-lg px-3 py-2 text-xs">
      {label && <p className="font-bold text-gray-700 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-gray-500">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span>{p.name}:</span>
          <span className="font-bold text-gray-900">{Number(p.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ── Selectable Donut ───────────────────────────────────────────────────────────
function SelectableDonut({ title, allSlices, colors }: { title: string; allSlices: StatusCount[]; colors: string[] }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(allSlices.map((d) => d.status)));
  const prevKey = useRef<string>('');
  useEffect(() => {
    const key = allSlices.map((d) => d.status).join(',');
    if (key !== prevKey.current) { prevKey.current = key; setSelected(new Set(allSlices.map((d) => d.status))); }
  }, [allSlices]);
  const toggle = (status: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(status)) { if (next.size === 1) return prev; next.delete(status); } else { next.add(status); }
    return next;
  });
  const filtered   = allSlices.filter((d) => selected.has(d.status));
  const grandTotal = allSlices.reduce((s, d) => s + d.count, 0);
  return (
    <div className="bg-white rounded-2xl border border-[#E0E0E0] p-5">
      <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">{title}</h3>
      <div className="flex flex-col h-[280px]">
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={filtered.length ? filtered : [{ status: 'none', count: 1 }]} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={58} outerRadius={78} paddingAngle={filtered.length > 1 ? 2 : 0} stroke="none">
                {filtered.map((d) => { const idx = allSlices.findIndex((s) => s.status === d.status); return <Cell key={d.status} fill={colors[idx % colors.length]} />; })}
              </Pie>
              <Tooltip content={<ChartTip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-full mt-1 space-y-1.5">
          {allSlices.map((d, i) => {
            const isOn = selected.has(d.status);
            const pct  = grandTotal > 0 ? Math.round((d.count / grandTotal) * 100) : 0;
            return (
              <button key={d.status} onClick={() => toggle(d.status)} className={`w-full flex items-center justify-between text-[10px] rounded px-1.5 py-1 transition-all hover:bg-gray-50 ${isOn ? 'opacity-100' : 'opacity-35'}`}>
                <div className="flex items-center gap-1.5 font-medium capitalize" style={{ color: isOn ? '#374151' : '#9CA3AF' }}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                  {d.status}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">{pct}%</span>
                  <span className="font-bold" style={{ color: isOn ? '#111827' : '#9CA3AF' }}>{d.count}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Merged Donut: Partners & Customers ────────────────────────────────────────
type CombinedSlice = { key: string; label: string; count: number };

function MergedDonut({ partnerSlices, customerSlices, colors }: { partnerSlices: StatusCount[]; customerSlices: StatusCount[]; colors: string[] }) {
  const allSlices = useMemo<CombinedSlice[]>(() => [
    ...partnerSlices.map((d) => ({ key: `partner:${d.status}`, label: `Partner · ${d.status}`, count: d.count })),
    ...customerSlices.map((d) => ({ key: `customer:${d.status}`, label: `Customer · ${d.status}`, count: d.count })),
  ], [partnerSlices, customerSlices]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set(allSlices.map((d: CombinedSlice) => d.key)));
  const prevKeys = useRef<string>('');
  useEffect(() => {
    const k = allSlices.map((d) => d.key).join(',');
    if (k !== prevKeys.current) { prevKeys.current = k; setSelected(new Set(allSlices.map((d) => d.key))); }
  }, [allSlices]);

  const toggle = (key: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(key)) { if (next.size === 1) return prev; next.delete(key); } else { next.add(key); }
    return next;
  });

  const filtered   = allSlices.filter((d) => selected.has(d.key));
  const grandTotal = allSlices.reduce((s, d) => s + d.count, 0);

  return (
    <div className="bg-white rounded-2xl border border-[#E0E0E0] p-5">
      <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Partners &amp; Customers by Status</h3>
      <div className="flex flex-col h-[280px]">
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={filtered.length ? filtered.map((d) => ({ status: d.label, count: d.count })) : [{ status: 'none', count: 1 }]}
                dataKey="count" nameKey="status" cx="50%" cy="50%"
                innerRadius={58} outerRadius={78} paddingAngle={filtered.length > 1 ? 2 : 0} stroke="none"
              >
                {filtered.map((d) => { const origIdx = allSlices.findIndex((s) => s.key === d.key); return <Cell key={d.key} fill={colors[origIdx % colors.length]} />; })}
              </Pie>
              <Tooltip content={<ChartTip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-full mt-1 space-y-1">
          {(['partner', 'customer'] as const).map((group) => {
            const groupSlices = allSlices.filter((d) => d.key.startsWith(group + ':'));
            if (!groupSlices.length) return null;
            return (
              <div key={group}>
                <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 px-1.5 mb-0.5 capitalize">{group}s</p>
                {groupSlices.map((d) => {
                  const isOn = selected.has(d.key);
                  const pct  = grandTotal > 0 ? Math.round((d.count / grandTotal) * 100) : 0;
                  const colorIdx = allSlices.findIndex((s) => s.key === d.key);
                  const sliceLabel = d.label.split(' · ')[1];
                  return (
                    <button key={d.key} onClick={() => toggle(d.key)} className={`w-full flex items-center justify-between text-[10px] rounded px-1.5 py-0.5 transition-all hover:bg-gray-50 ${isOn ? 'opacity-100' : 'opacity-35'}`}>
                      <div className="flex items-center gap-1.5 font-medium capitalize" style={{ color: isOn ? '#374151' : '#9CA3AF' }}>
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: colors[colorIdx % colors.length] }} />
                        {sliceLabel}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">{pct}%</span>
                        <span className="font-bold" style={{ color: isOn ? '#111827' : '#9CA3AF' }}>{d.count}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Status badge map ───────────────────────────────────────────────────────────
const STATUS: Record<string, { dot: string; text: string; bg: string }> = {
  active:   { dot: 'bg-[#2E7D32]', text: 'text-[#2E7D32]', bg: 'bg-green-50' },
  inactive: { dot: 'bg-[#757575]', text: 'text-[#757575]', bg: 'bg-[#F9F9F9]' },
  banned:   { dot: 'bg-red-500',   text: 'text-red-700',   bg: 'bg-red-50' },
};

// ── Main component ─────────────────────────────────────────────────────────────
function DashboardContent() {
  const [data,          setData]          = useState<DashboardData | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [permissions,   setPermissions]   = useState<string[]>([]);

  const [PRIMARY, setPrimary] = useState(FALLBACK_PRIMARY);
  const [ACCENT,  setAccent]  = useState(FALLBACK_ACCENT);

  useEffect(() => {
    setPrimary(getCssVar('--primary', FALLBACK_PRIMARY));
    setAccent(getCssVar('--accent',  FALLBACK_ACCENT));
  }, []);

  const COLORS = [PRIMARY, ACCENT, '#7B3FA0', '#E91E8C', '#2E7D32', '#F59E0B', '#1565C0', '#E53935'];

  const can = (slug: string) => permissions.includes(slug);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()),
      fetch('/api/admin/dashboard').then((r) => r.json()),
      fetch('/api/admin/analytics?days=30').then((r) => r.json()),
    ])
      .then(([me, dash, analytics]) => {
        if (Array.isArray(me.permissions)) setPermissions(me.permissions);
        setData(dash);
        setAnalyticsData(analytics);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const s = data?.stats;
  const a = analyticsData;

  // Build chart data
  const periodDays = a?.summary?.periodDays ?? 30;
  const bookingFilled  = a ? fillDays(a.bookingGrowth,  periodDays) : [];
  const customerFilled = a ? fillDays(a.customerGrowth, periodDays) : [];
  const revenueFilled  = a ? fillRevenueDays(a.revenueGrowth, periodDays) : [];

  const mergedGrowth = bookingFilled.map((d, i) => ({
    day:       fmtDay(d.day),
    Bookings:  d.count,
    Customers: customerFilled[i]?.count ?? 0,
  }));

  const revenueChartData = revenueFilled.map((d) => ({
    day:     fmtDay(d.day),
    Revenue: d.revenue,
  }));

  // Stat cards
  const ALL_STATS = [
    { label: 'Total Users',       value: s?.totalUsers ?? 0,            sub: `${s?.activeUsers ?? 0} active`,        icon: <Users size={18} />,   color: 'var(--primary)', href: '/admin/users',  permission: 'users.view',  trend: '+12%' },
    { label: 'Roles',             value: s?.totalRoles ?? 0,            sub: 'Configured roles',                     icon: <Shield size={18} />,  color: 'var(--accent)',  href: '/admin/roles',  permission: 'roles.view',  trend: null   },
    { label: 'Pages',             value: s?.totalPages ?? 0,            sub: `${s?.publishedPages ?? 0} published`,  icon: <FileText size={18} />, color: 'var(--primary)', href: '/admin/pages',  permission: 'pages.view',  trend: null   },
    { label: 'Delete Requests',   value: s?.pendingDeleteRequests ?? 0, sub: 'Pending review',                       icon: <Trash2 size={18} />,  color: '#e53935',        href: '/admin/users',  permission: 'users.view',  trend: null   },
  ];

  const ALL_ACTIONS = [
    { label: 'Add New User', href: '/admin/users/new', icon: <Users size={15} />,    permission: 'users.create', isPrimary: true  },
    { label: 'Create Role',  href: '/admin/roles/new', icon: <Shield size={15} />,   permission: 'roles.create', isPrimary: false },
    { label: 'New Page',     href: '/admin/pages/new', icon: <FileText size={15} />, permission: 'pages.create', isPrimary: true  },
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
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' })}
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
              <div
                className="w-12 h-12 text-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform"
                style={{ backgroundColor: stat.color, boxShadow: `0 4px 14px color-mix(in srgb, ${stat.color} 30%, transparent)` }}
              >
                {stat.icon}
              </div>
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

      {/* ── Charts Row: Donut pair ──────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="h-[360px] bg-white rounded-2xl border border-[#E0E0E0] animate-pulse" />
          <div className="h-[360px] bg-white rounded-2xl border border-[#E0E0E0] animate-pulse" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <SelectableDonut
            title="Bookings by Status"
            allSlices={a?.bookingsByStatus ?? []}
            colors={COLORS}
          />
          <MergedDonut
            partnerSlices={a?.partnersByStatus ?? []}
            customerSlices={a?.customersByStatus ?? []}
            colors={COLORS}
          />
        </div>
      )}

      {/* ── Charts Row: Area charts ─────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="h-[300px] bg-white rounded-2xl border border-[#E0E0E0] animate-pulse" />
          <div className="h-[300px] bg-white rounded-2xl border border-[#E0E0E0] animate-pulse" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

          {/* Daily Bookings & Customer Signups */}
          <div className="bg-white rounded-2xl border border-[#E0E0E0] p-5">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-4">
              Daily Bookings &amp; Customer Signups
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={mergedGrowth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="dbgB" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={PRIMARY} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dbgC" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={ACCENT} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} minTickGap={30} />
                <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="Bookings"  stroke={PRIMARY} strokeWidth={2.5} fill="url(#dbgB)" dot={{ r: 3, fill: '#fff', stroke: PRIMARY, strokeWidth: 2 }} activeDot={{ r: 5, fill: PRIMARY, stroke: '#fff', strokeWidth: 2 }} />
                <Area type="monotone" dataKey="Customers" stroke={ACCENT}  strokeWidth={2}   fill="url(#dbgC)" dot={{ r: 3, fill: '#fff', stroke: ACCENT,  strokeWidth: 2 }} activeDot={{ r: 5, fill: ACCENT,  stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue Trend */}
          <div className="bg-white rounded-2xl border border-[#E0E0E0] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Revenue Trend (Completed Bookings)
              </h3>
              <span className="text-[11px] font-bold text-gray-700">
                Avg ₹{(a?.summary?.avgBookingValue ?? 0).toLocaleString()} / booking
              </span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="dbgR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#2E7D32" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2E7D32" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} minTickGap={30} />
                <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(v) => `₹${v}`} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="Revenue" stroke="#2E7D32" strokeWidth={2.5} fill="url(#dbgR)" dot={{ r: 3, fill: '#fff', stroke: '#2E7D32', strokeWidth: 2 }} activeDot={{ r: 5, fill: '#2E7D32', stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

        </div>
      )}

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

          {/* System info */}
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
