'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  RefreshCw, Clock, CalendarDays, Trash2, Users, ShoppingBag,
  UserCheck, TrendingUp, Package, Layers, FileText, Activity,
} from 'lucide-react';
import PermissionGuard from '@/components/admin/PermissionGuard';
import WorldMap from '@/components/admin/WorldMap';
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Summary {
  totalUsers: number; activeUsers: number; inactiveUsers: number; bannedUsers: number;
  totalCustomers: number; totalPartners: number; approvedPartners: number; pendingPartners: number;
  totalBookings: number; completedBookings: number; cancelledBookings: number;
  bookingsInPeriod: number; customersInPeriod: number; partnersInPeriod: number;
  bookingsThisWeek: number; bookingsLastWeek: number;
  bookingsThisMonth: number; bookingsLastMonth: number;
  customersThisWeek: number;
  totalRevenue: number; avgBookingValue: number;
  totalServices: number; totalCategories: number;
  totalPages: number; publishedPages: number; draftPages: number;
  totalRoles: number; totalPermissions: number;
  totalLogs: number; logsToday: number; logsThisWeek: number; logsLastWeek: number;
  pendingDeletes: number; periodDays: number;
}
interface DayCount    { day: string; count: number }
interface DayRevenue  { day: string; revenue: number }
interface StatusCount { status: string; count: number }
interface ServiceCount { service: string; count: number; revenue: number }
interface ModuleCount { module: string; count: number }
interface ActionCount { action: string; count: number }
interface CountryCount { code: string; country: string; count: number }
interface CityCount    { city: string; country: string; count: number }
interface PageStat     { title: string; slug: string; views: number }
interface AnalyticsData {
  summary: Summary;
  bookingGrowth: DayCount[];
  customerGrowth: DayCount[];
  partnerGrowth: DayCount[];
  activityGrowth: DayCount[];
  revenueGrowth: DayRevenue[];
  bookingsByStatus: StatusCount[];
  bookingsByService: ServiceCount[];
  partnersByStatus: StatusCount[];
  customersByStatus: StatusCount[];
  activityByModule: ModuleCount[];
  activityByAction: ActionCount[];
  usersByStatus: StatusCount[];
  pagesByStatus: StatusCount[];
  permissionsByModule: ModuleCount[];
  usersByCountry: CountryCount[];
  topCities: CityCount[];
  topPages: PageStat[];
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

function fmtDate(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  const dd   = String(d.getDate()).padStart(2, '0');
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd} / ${mm} / ${yyyy}`;
}

function fillDays(data: DayCount[], days: number, fromDate?: string, toDate?: string): DayCount[] {
  const map: Record<string, number> = {};
  data.forEach((d) => { map[d.day] = Number(d.count); });
  const result: DayCount[] = [];

  if (fromDate && toDate) {
    const start = new Date(fromDate + 'T12:00:00');
    const end   = new Date(toDate   + 'T12:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      result.push({ day: key, count: map[key] ?? 0 });
    }
  } else {
    for (let i = days - 1; i >= 0; i--) {
      const d   = new Date();
      const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - i));
      const key = utc.toISOString().slice(0, 10);
      result.push({ day: key, count: map[key] ?? 0 });
    }
  }
  return result;
}

function fillRevenueDays(data: DayRevenue[], days: number, fromDate?: string, toDate?: string): DayRevenue[] {
  const map: Record<string, number> = {};
  data.forEach((d) => { map[d.day] = Number(d.revenue); });
  const result: DayRevenue[] = [];

  if (fromDate && toDate) {
    const start = new Date(fromDate + 'T12:00:00');
    const end   = new Date(toDate   + 'T12:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      result.push({ day: key, revenue: map[key] ?? 0 });
    }
  } else {
    for (let i = days - 1; i >= 0; i--) {
      const d   = new Date();
      const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - i));
      const key = utc.toISOString().slice(0, 10);
      result.push({ day: key, revenue: map[key] ?? 0 });
    }
  }
  return result;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, isPrimary, primaryColor, accentColor,
}: {
  label: string; value: string | number; sub: string;
  icon: React.ElementType; isPrimary?: boolean;
  primaryColor: string; accentColor: string;
}) {
  return (
    <div className="bg-white rounded-md border border-[#E8E8E8] p-4 flex flex-col justify-between min-w-[170px] relative overflow-hidden flex-shrink-0">
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: isPrimary ? primaryColor : accentColor }}
      />
      <div className="flex items-start justify-between mt-1">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</p>
        <Icon size={14} style={{ color: isPrimary ? primaryColor : accentColor }} className="opacity-60 flex-shrink-0" />
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
      <p className="text-[10px] text-gray-400 mt-2">{sub}</p>
    </div>
  );
}

// ── Selectable Donut (single dataset) ─────────────────────────────────────────
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
    <div className="bg-white rounded-md border border-[#E8E8E8] p-5 shadow-sm">
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

function MergedDonut({
  partnerSlices,
  customerSlices,
  colors,
}: {
  partnerSlices: StatusCount[];
  customerSlices: StatusCount[];
  colors: string[];
}) {
  // Build a flat combined list with a unique key per slice
  const allSlices = useMemo<CombinedSlice[]>(() => [
    ...partnerSlices.map((d) => ({ key: `partner:${d.status}`, label: `Partner · ${d.status}`, count: d.count })),
    ...customerSlices.map((d) => ({ key: `customer:${d.status}`, label: `Customer · ${d.status}`, count: d.count })),
  ], [partnerSlices, customerSlices]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set(allSlices.map((d: CombinedSlice) => d.key)));

  // Sync selection when data changes
  const prevKeys = useRef<string>('');
  useEffect(() => {
    const k = allSlices.map((d) => d.key).join(',');
    if (k !== prevKeys.current) {
      prevKeys.current = k;
      setSelected(new Set(allSlices.map((d) => d.key)));
    }
  }, [allSlices]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const filtered   = allSlices.filter((d) => selected.has(d.key));
  const grandTotal = allSlices.reduce((s, d) => s + d.count, 0);

  return (
    <div className="bg-white rounded-md border border-[#E8E8E8] p-5 shadow-sm">
      <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">
        Partners &amp; Customers by Status
      </h3>

      <div className="flex flex-col h-[280px]">
        {/* Donut */}
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={filtered.length ? filtered.map((d) => ({ status: d.label, count: d.count })) : [{ status: 'none', count: 1 }]}
                dataKey="count"
                nameKey="status"
                cx="50%" cy="50%"
                innerRadius={58} outerRadius={78}
                paddingAngle={filtered.length > 1 ? 2 : 0}
                stroke="none"
              >
                {filtered.map((d) => {
                  const origIdx = allSlices.findIndex((s) => s.key === d.key);
                  return <Cell key={d.key} fill={colors[origIdx % colors.length]} />;
                })}
              </Pie>
              <Tooltip content={<ChartTip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend — clickable toggles, grouped by Partners then Customers */}
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
                  const sliceLabel = d.label.split(' · ')[1]; // e.g. "pending"
                  return (
                    <button
                      key={d.key}
                      onClick={() => toggle(d.key)}
                      className={`w-full flex items-center justify-between text-[10px] rounded px-1.5 py-0.5 transition-all hover:bg-gray-50 ${
                        isOn ? 'opacity-100' : 'opacity-35'
                      }`}
                    >
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

function ChartTip({ active, payload, label }: { active?: boolean; payload?: {color: string; name: string; value: number}[]; label?: string }) {
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

// ── Date filter options ────────────────────────────────────────────────────────
const DATE_FILTERS = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'dd / mm / yyyy', 'Custom'] as const;
type DateFilter = typeof DATE_FILTERS[number];

// ── Main component ─────────────────────────────────────────────────────────────
function AnalyticsContent() {
  const [data,       setData]       = useState<AnalyticsData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing,   setClearing]   = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('Last 7 days');

  // Custom date range state
  const [customFrom, setCustomFrom] = useState('');
  const [customTo,   setCustomTo]   = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const customRef = useRef<HTMLDivElement>(null);

  // Date picker state (for "dd / mm / yyyy" single-day picker)
  const [pickerDate,  setPickerDate]  = useState('');
  const [showPicker,  setShowPicker]  = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const [PRIMARY, setPrimary] = useState(FALLBACK_PRIMARY);
  const [ACCENT,  setAccent]  = useState(FALLBACK_ACCENT);

  useEffect(() => {
    setPrimary(getCssVar('--primary', FALLBACK_PRIMARY));
    setAccent(getCssVar('--accent',  FALLBACK_ACCENT));
  }, []);

  const COLORS = [PRIMARY, ACCENT, '#7B3FA0', '#E91E8C', '#2E7D32', '#F59E0B', '#1565C0', '#E53935'];

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (customRef.current && !customRef.current.contains(e.target as Node)) setShowCustom(false);
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Build query string from current filter
  const buildQuery = useCallback(() => {
    if (dateFilter === 'Last 7 days')  return '?days=7';
    if (dateFilter === 'Last 30 days') return '?days=30';
    if (dateFilter === 'Last 90 days') return '?days=90';
    if (dateFilter === 'dd / mm / yyyy' && pickerDate) return `?from=${pickerDate}&to=${pickerDate}`;
    if (dateFilter === 'Custom' && customFrom && customTo) return `?from=${customFrom}&to=${customTo}`;
    return '?days=30';
  }, [dateFilter, pickerDate, customFrom, customTo]);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch(`/api/admin/analytics${buildQuery()}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [buildQuery]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Clear analytics data (soft-deletes all activity_logs)
  const handleClear = async () => {
    if (!confirm('This will permanently clear all activity log data. This cannot be undone. Continue?')) return;
    setClearing(true);
    try {
      const res = await fetch('/api/admin/analytics', { method: 'DELETE' });
      if (res.ok) {
        await fetchData(true);
      }
    } finally {
      setClearing(false);
    }
  };

  const s = data?.summary;

  // Resolve period days
  const periodDays = s?.periodDays ?? 30;

  // Resolve from/to for display
  const resolvedFrom = dateFilter === 'Custom' && customFrom ? customFrom
    : dateFilter === 'dd / mm / yyyy' && pickerDate ? pickerDate
    : new Date(Date.now() - (periodDays - 1) * 86400000).toISOString().slice(0, 10);
  const resolvedTo = dateFilter === 'Custom' && customTo ? customTo
    : dateFilter === 'dd / mm / yyyy' && pickerDate ? pickerDate
    : new Date().toISOString().slice(0, 10);

  const startStr = fmtDate(resolvedFrom);
  const todayStr = fmtDate(resolvedTo);

  // Fill growth series
  const bookingFilled  = data ? fillDays(data.bookingGrowth,  periodDays, customFrom || undefined, customTo || undefined) : [];
  const customerFilled = data ? fillDays(data.customerGrowth, periodDays, customFrom || undefined, customTo || undefined) : [];
  const activityFilled = data ? fillDays(data.activityGrowth, periodDays, customFrom || undefined, customTo || undefined) : [];
  const revenueFilled  = data ? fillRevenueDays(data.revenueGrowth, periodDays, customFrom || undefined, customTo || undefined) : [];

  const mergedGrowth = bookingFilled.map((d, i) => ({
    day:      fmtDay(d.day),
    Bookings: d.count,
    Customers: customerFilled[i]?.count ?? 0,
    Activity:  activityFilled[i]?.count ?? 0,
  }));

  const revenueChartData = revenueFilled.map((d) => ({
    day:     fmtDay(d.day),
    Revenue: d.revenue,
  }));

  return (
    <div className="p-4 lg:p-6 bg-[#f8f9fa] min-h-screen font-sans">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Analytics</h1>
          <div className="flex items-center text-[11px] text-gray-500 mt-1 font-medium">
            <span>Platform overview — bookings, customers, partners & activity</span>
            <span className="w-1.5 h-1.5 rounded-full ml-2" style={{ backgroundColor: PRIMARY }} />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <button
            onClick={handleClear}
            disabled={clearing || refreshing}
            className="text-[11px] font-semibold px-3 py-1.5 bg-white border border-red-200 rounded-md hover:bg-red-50 flex items-center gap-1.5 transition-colors text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={12} className={clearing ? 'animate-pulse' : ''} />
            {clearing ? 'Clearing…' : 'Clear Analytics Data'}
          </button>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing || clearing}
            className="text-[11px] font-semibold px-3 py-1.5 bg-white border border-gray-200 rounded-md hover:bg-gray-50 flex items-center gap-1.5 transition-colors text-gray-700 disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <span className="text-[11px] font-bold px-2.5 py-1.5 bg-[#fff8e1] text-[#b45309] border border-[#fde68a] rounded-md">
            Admin
          </span>
        </div>
      </div>

      {/* ── Controls Bar ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-[#E8E8E8] rounded-md p-3 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full xl:w-auto overflow-hidden">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-medium whitespace-nowrap border-b sm:border-b-0 sm:border-r border-gray-100 pb-3 sm:pb-0 sm:pr-4">
            <Clock size={12} />
            <span>Tracking: <b className="text-gray-700">Bookings, Customers, Partners, Activity</b></span>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide w-full sm:w-auto">
            {DATE_FILTERS.map((t) => {
              const isActive = dateFilter === t;
              return (
                <div key={t} className="relative flex-shrink-0">
                  {/* dd / mm / yyyy — single day picker */}
                  {t === 'dd / mm / yyyy' ? (
                    <div ref={pickerRef} className="relative">
                      <button
                        onClick={() => { setDateFilter(t); setShowPicker((v) => !v); setShowCustom(false); }}
                        className={`whitespace-nowrap px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
                          isActive ? 'text-white shadow-sm' : 'bg-white text-gray-500 border border-[#E8E8E8] hover:bg-gray-50'
                        }`}
                        style={isActive ? { backgroundColor: PRIMARY } : {}}
                      >
                        {pickerDate && dateFilter === t ? fmtDate(pickerDate) : 'dd / mm / yyyy'}
                      </button>
                      {showPicker && (
                        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-[#E8E8E8] rounded-md shadow-lg p-3 min-w-[200px]">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Select Date</p>
                          <input
                            type="date"
                            max={new Date().toISOString().slice(0, 10)}
                            value={pickerDate}
                            onChange={(e) => {
                              setPickerDate(e.target.value);
                              setShowPicker(false);
                            }}
                            className="w-full text-[11px] border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1"
                            style={{ '--tw-ring-color': PRIMARY } as React.CSSProperties}
                          />
                        </div>
                      )}
                    </div>
                  ) : t === 'Custom' ? (
                    /* Custom date range picker */
                    <div ref={customRef} className="relative">
                      <button
                        onClick={() => { setDateFilter(t); setShowCustom((v) => !v); setShowPicker(false); }}
                        className={`whitespace-nowrap px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
                          isActive ? 'text-white shadow-sm' : 'bg-white text-gray-500 border border-[#E8E8E8] hover:bg-gray-50'
                        }`}
                        style={isActive ? { backgroundColor: PRIMARY } : {}}
                      >
                        {customFrom && customTo && dateFilter === t
                          ? `${fmtDate(customFrom)} — ${fmtDate(customTo)}`
                          : 'Custom'}
                      </button>
                      {showCustom && (
                        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-[#E8E8E8] rounded-md shadow-lg p-3 min-w-[240px]">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Custom Range</p>
                          <div className="space-y-2">
                            <div>
                              <label className="text-[10px] text-gray-500 font-medium">From</label>
                              <input
                                type="date"
                                max={customTo || new Date().toISOString().slice(0, 10)}
                                value={customFrom}
                                onChange={(e) => setCustomFrom(e.target.value)}
                                className="w-full text-[11px] border border-gray-200 rounded px-2 py-1.5 mt-0.5 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-500 font-medium">To</label>
                              <input
                                type="date"
                                min={customFrom}
                                max={new Date().toISOString().slice(0, 10)}
                                value={customTo}
                                onChange={(e) => setCustomTo(e.target.value)}
                                className="w-full text-[11px] border border-gray-200 rounded px-2 py-1.5 mt-0.5 focus:outline-none"
                              />
                            </div>
                            <button
                              disabled={!customFrom || !customTo}
                              onClick={() => { setShowCustom(false); fetchData(); }}
                              className="w-full text-[11px] font-semibold py-1.5 rounded-md text-white disabled:opacity-40 transition-colors"
                              style={{ backgroundColor: PRIMARY }}
                            >
                              Apply Range
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => { setDateFilter(t); setShowCustom(false); setShowPicker(false); }}
                      className={`whitespace-nowrap px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
                        isActive ? 'text-white shadow-sm' : 'bg-white text-gray-500 border border-[#E8E8E8] hover:bg-gray-50'
                      }`}
                      style={isActive ? { backgroundColor: PRIMARY } : {}}
                    >
                      {t}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="text-[10px] text-gray-400 font-bold flex items-center gap-1.5 whitespace-nowrap uppercase tracking-wide">
          <CalendarDays size={12} /> {startStr} — {todayStr}
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-6">
          <div className="flex gap-4 overflow-hidden">
            {[...Array(5)].map((_, i) => <div key={i} className="w-44 h-24 bg-gray-200 rounded-md flex-shrink-0" />)}
          </div>
          <div className="h-64 bg-gray-200 rounded-md" />
          <div className="grid grid-cols-3 gap-6">
            <div className="h-48 bg-gray-200 rounded-md" />
            <div className="h-48 bg-gray-200 rounded-md" />
            <div className="h-48 bg-gray-200 rounded-md" />
          </div>
        </div>
      ) : (
        <>
          {/* ── Stats Row ──────────────────────────────────────────────────── */}
          <div className="flex gap-4 overflow-x-auto pb-4 mb-6 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
            <StatCard label="Total Bookings"    value={s?.totalBookings ?? 0}    sub="all time"                 icon={ShoppingBag}  isPrimary  primaryColor={PRIMARY} accentColor={ACCENT} />
            <StatCard label="Bookings (Period)"  value={s?.bookingsInPeriod ?? 0} sub="in selected period"       icon={TrendingUp}   isPrimary  primaryColor={PRIMARY} accentColor={ACCENT} />
            <StatCard label="Total Customers"   value={s?.totalCustomers ?? 0}   sub="registered in app"        icon={Users}        isPrimary  primaryColor={PRIMARY} accentColor={ACCENT} />
            <StatCard label="Total Partners"    value={s?.totalPartners ?? 0}    sub={`${s?.approvedPartners ?? 0} approved · ${s?.pendingPartners ?? 0} pending`} icon={UserCheck} isPrimary primaryColor={PRIMARY} accentColor={ACCENT} />
            <StatCard label="Partner Requests"  value={s?.pendingPartners ?? 0}  sub="awaiting approval"        icon={Clock}        primaryColor={PRIMARY} accentColor={ACCENT} />
            <StatCard label="Total Revenue"     value={`₹${(s?.totalRevenue ?? 0).toLocaleString()}`} sub="completed bookings" icon={TrendingUp} isPrimary primaryColor={PRIMARY} accentColor={ACCENT} />
            {/* <StatCard label="Total Services"    value={s?.totalServices ?? 0}    sub={`${s?.totalCategories ?? 0} categories`} icon={Package} primaryColor={PRIMARY} accentColor={ACCENT} /> */}
            {/* <StatCard label="Activity Logs"     value={s?.totalLogs ?? 0}        sub={`${s?.logsToday ?? 0} today`}            icon={Activity} primaryColor={PRIMARY} accentColor={ACCENT} /> */}
            {/* <StatCard label="Admin Users"       value={s?.totalUsers ?? 0}       sub={`${s?.activeUsers ?? 0} active`}         icon={FileText} primaryColor={PRIMARY} accentColor={ACCENT} /> */}
            {/* <StatCard label="Total Pages"       value={s?.totalPages ?? 0}       sub={`${s?.publishedPages ?? 0} published`}   icon={Layers}   primaryColor={PRIMARY} accentColor={ACCENT} /> */}
          </div>

          {/* ── Booking & Customer Trend + Revenue Trend — side by side ─────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

            {/* Daily Bookings & Customer Signups */}
            <div className="bg-white rounded-md border border-[#E8E8E8] p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Daily Bookings & Customer Signups</h3>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={mergedGrowth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={PRIMARY} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={ACCENT} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} minTickGap={30} />
                  <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTip />} />
                  <Area type="monotone" dataKey="Bookings"  stroke={PRIMARY} strokeWidth={2.5} fill="url(#gB)" dot={{ r: 3, fill: '#fff', stroke: PRIMARY, strokeWidth: 2 }} activeDot={{ r: 5, fill: PRIMARY, stroke: '#fff', strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="Customers" stroke={ACCENT}  strokeWidth={2}   fill="url(#gC)" dot={{ r: 3, fill: '#fff', stroke: ACCENT,  strokeWidth: 2 }} activeDot={{ r: 5, fill: ACCENT,  stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Revenue Trend */}
            <div className="bg-white rounded-md border border-[#E8E8E8] p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Revenue Trend (Completed Bookings)</h3>
                <span className="text-[11px] font-bold text-gray-700">
                  Avg ₹{(s?.avgBookingValue ?? 0).toLocaleString()} / booking
                </span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={revenueChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#2E7D32" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#2E7D32" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} minTickGap={30} />
                  <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip content={<ChartTip />} />
                  <Area type="monotone" dataKey="Revenue" stroke="#2E7D32" strokeWidth={2.5} fill="url(#gR)" dot={{ r: 3, fill: '#fff', stroke: '#2E7D32', strokeWidth: 2 }} activeDot={{ r: 5, fill: '#2E7D32', stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

          </div>

          {/* ── 2 Column Charts ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

            {/* Bookings by Status — Selectable Donut */}
            <SelectableDonut
              title="Bookings by Status"
              allSlices={data?.bookingsByStatus ?? []}
              colors={COLORS}
            />

            {/* Partners & Customers by Status — Merged Donut with tab switcher */}
            <MergedDonut
              partnerSlices={data?.partnersByStatus ?? []}
              customerSlices={data?.customersByStatus ?? []}
              colors={COLORS}
            />

          </div>

          {/* ── Users by Country — World Map ────────────────────────────────── */}
          <div className="bg-white rounded-md border border-[#E8E8E8] p-5 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Users by Country</h3>
              <span className="text-[10px] text-gray-400">{(data?.usersByCountry ?? []).length} countries</span>
            </div>
            <div className="flex gap-6 items-start">

              {/* Map — fixed height, fills remaining width */}
              <div className="flex-1 min-w-0 h-[580px]">
                <WorldMap data={data?.usersByCountry ?? []} primaryColor={PRIMARY} />
              </div>

              {/* Country list — same height as map, scrollable */}
              <div className="w-[210px] flex-shrink-0 h-[380px] flex flex-col">
                <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-gray-400 px-1 pb-2 border-b border-gray-100 mb-1">
                  <span>Country</span>
                  <span>Users</span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-0.5 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                  {(data?.usersByCountry ?? []).length === 0 ? (
                    <p className="text-[10px] text-gray-400 text-center mt-10">No location data</p>
                  ) : (() => {
                    const maxC = Math.max(...(data?.usersByCountry ?? []).map(c => c.count), 1);
                    return (data?.usersByCountry ?? []).map((d, i) => {
                      const pct = Math.round((d.count / maxC) * 100);
                      return (
                        <div key={d.code} className="flex items-center gap-2 px-1 py-1.5 rounded hover:bg-gray-50 transition-colors">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-gray-700 truncate font-medium">{d.country}</span>
                              <span className="text-[10px] font-bold text-gray-900 ml-2 flex-shrink-0">{d.count}</span>
                            </div>
                            <div className="h-[3px] rounded-full bg-gray-100 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

            </div>
          </div>

          {/* ── Top Cities & Top Pages — side by side ───────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

            {/* Top Cities */}
            <div className="bg-white rounded-md border border-[#E8E8E8] p-5 shadow-sm flex flex-col">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Top Cities</h3>
              <div className="flex-1 overflow-y-auto">
                {(data?.topCities ?? []).length === 0 ? (
                  <p className="text-[11px] text-gray-400 text-center py-8">No city data available</p>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-[9px] font-bold uppercase tracking-wider text-gray-400 pb-2 pr-3">#</th>
                        <th className="text-left text-[9px] font-bold uppercase tracking-wider text-gray-400 pb-2 pr-3">City</th>
                        <th className="text-left text-[9px] font-bold uppercase tracking-wider text-gray-400 pb-2 pr-3">Country</th>
                        <th className="text-right text-[9px] font-bold uppercase tracking-wider text-gray-400 pb-2">Users</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.topCities ?? []).map((d, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="py-2 pr-3 text-[10px] text-gray-400 font-medium">{i + 1}</td>
                          <td className="py-2 pr-3">
                            <span className="text-[11px] font-semibold text-gray-800">{d.city}</span>
                          </td>
                          <td className="py-2 pr-3">
                            <span className="text-[10px] text-gray-500">{d.country}</span>
                          </td>
                          <td className="py-2 text-right">
                            <span className="text-[11px] font-bold text-gray-900">{d.count}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Top Pages */}
            <div className="bg-white rounded-md border border-[#E8E8E8] p-5 shadow-sm flex flex-col">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Top Pages</h3>
              <div className="flex-1 overflow-y-auto">
                {(data?.topPages ?? []).length === 0 ? (
                  <p className="text-[11px] text-gray-400 text-center py-8">No page data available</p>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-[9px] font-bold uppercase tracking-wider text-gray-400 pb-2 pr-3">#</th>
                        <th className="text-left text-[9px] font-bold uppercase tracking-wider text-gray-400 pb-2 pr-3">Page</th>
                        <th className="text-right text-[9px] font-bold uppercase tracking-wider text-gray-400 pb-2 pr-3">Views</th>
                        <th className="text-right text-[9px] font-bold uppercase tracking-wider text-gray-400 pb-2 pr-3">Avg Time</th>
                        <th className="text-right text-[9px] font-bold uppercase tracking-wider text-gray-400 pb-2">Bounce</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.topPages ?? []).map((d, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="py-2 pr-3 text-[10px] text-gray-400 font-medium">{i + 1}</td>
                          <td className="py-2 pr-3 max-w-[160px]">
                            <p className="text-[11px] font-semibold text-gray-800 truncate">{d.title}</p>
                            <p className="text-[9px] text-gray-400 truncate">/{d.slug}</p>
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <span className="text-[11px] font-bold text-gray-900">{d.views}</span>
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <span className="text-[10px] text-gray-400">—</span>
                          </td>
                          <td className="py-2 text-right">
                            <span className="text-[10px] text-gray-400">—</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

          </div>

          {/* ── Bookings by Service + Activity by Action (side by side) ──────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

            {/* Bookings by Service */}
            <div className="bg-white rounded-md border border-[#E8E8E8] p-5 shadow-sm">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-4">Bookings by Service</h3>
              <div className="space-y-3">
                {(data?.bookingsByService ?? []).map((d, i) => {
                  const maxCount = Math.max(...(data?.bookingsByService ?? []).map((x) => x.count), 1);
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="font-medium text-gray-700">{d.service}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400 text-[10px]">₹{d.revenue.toLocaleString()}</span>
                          <span className="font-bold text-gray-800">{d.count} bookings</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${(d.count / maxCount) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Activity by Action Type */}
            <div className="bg-white rounded-md border border-[#E8E8E8] p-5 shadow-sm">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-4">Activity by Action Type</h3>
              <div className="space-y-3">
                {(data?.activityByAction ?? []).map((d, i) => {
                  const maxCount = Math.max(...(data?.activityByAction ?? []).map((x) => x.count), 1);
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="font-medium text-gray-700 capitalize">{d.action}</span>
                        <span className="font-bold text-gray-800">{d.count}</span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(d.count / maxCount) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <PermissionGuard permission="dashboard.view">
      <AnalyticsContent />
    </PermissionGuard>
  );
}
