'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Users, FileText, Shield, Key, Activity, TrendingUp, TrendingDown,
  Minus, RefreshCw, Clock, BarChart2, PieChart as PieIcon, Zap,
  ArrowUpRight, CalendarDays,
} from 'lucide-react';
import PermissionGuard from '@/components/admin/PermissionGuard';
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Summary {
  totalUsers: number; activeUsers: number; inactiveUsers: number; bannedUsers: number;
  totalPages: number; publishedPages: number; draftPages: number;
  totalRoles: number; totalPermissions: number;
  totalLogs: number; logsToday: number; pendingDeletes: number;
  usersThisMonth: number; usersLastMonth: number;
  logsThisWeek: number; logsLastWeek: number;
  usersThisWeek: number; usersLastWeek: number;
}
interface DayCount    { day: string; count: number }
interface ModuleCount { module: string; count: number }
interface ActionCount { action: string; count: number }
interface StatusCount { status: string; count: number }
interface UserCount   { user_name: string; count: number }
interface RecentLog {
  id: number; user_name: string; action: string;
  module: string; target_name: string | null;
  description: string | null; created_at: string;
}
interface AnalyticsData {
  summary: Summary;
  userGrowth: DayCount[];
  activityGrowth: DayCount[];
  activityByModule: ModuleCount[];
  activityByAction: ActionCount[];
  usersByStatus: StatusCount[];
  pagesByStatus: StatusCount[];
  permissionsByModule: ModuleCount[];
  topActiveUsers: UserCount[];
  recentActivity: RecentLog[];
}

// ── CSS var resolver (Recharts needs real hex values) ─────────────────────────
function getCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
const FALLBACK_PRIMARY = '#4A2372';
const FALLBACK_ACCENT  = '#C2185B';

// ── Helpers ───────────────────────────────────────────────────────────────────
function trendPct(cur: number, prev: number): { pct: number; dir: 'up' | 'down' | 'flat' } {
  if (prev === 0) return { pct: cur > 0 ? 100 : 0, dir: cur > 0 ? 'up' : 'flat' };
  const p = Math.round(((cur - prev) / prev) * 100);
  return { pct: Math.abs(p), dir: p > 0 ? 'up' : p < 0 ? 'down' : 'flat' };
}

function fmtDay(day: string) {
  return new Date(day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fillDays(data: DayCount[], days = 30): DayCount[] {
  const map: Record<string, number> = {};
  data.forEach((d) => { map[d.day] = Number(d.count); });
  const result: DayCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - i));
    const key = utc.toISOString().slice(0, 10);
    result.push({ day: key, count: map[key] ?? 0 });
  }
  return result;
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, iconColor, trend,
}: {
  label: string; value: number; sub: string;
  icon: React.ReactNode; iconColor?: string;
  trend?: { pct: number; dir: 'up' | 'down' | 'flat'; label: string };
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8E8E8] p-5 hover:shadow-md hover:border-[#d0d0d0] transition-all flex items-center gap-5">
      <div
        className="w-12 h-12 text-white rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: iconColor || 'var(--primary)',
          boxShadow: `0 4px 12px color-mix(in srgb, ${iconColor || 'var(--primary)'} 35%, transparent)`,
        }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-2xl font-bold text-[#1a1a1a] tabular-nums leading-none">
            {value.toLocaleString()}
          </p>
          {trend && (
            <span className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
              trend.dir === 'up'   ? 'bg-emerald-50 text-emerald-600' :
              trend.dir === 'down' ? 'bg-red-50 text-red-500' :
              'bg-[#F5F5F5] text-[#9CA3AF]'
            }`}>
              {trend.dir === 'up'   ? <TrendingUp size={9} />   :
               trend.dir === 'down' ? <TrendingDown size={9} /> :
               <Minus size={9} />}
              <span className="ml-0.5">{trend.dir !== 'flat' ? `${trend.pct}%` : '—'}</span>
            </span>
          )}
        </div>
        <p className="text-[13px] font-semibold text-[#374151] mt-1 truncate">{label}</p>
        <p className="text-[11px] text-[#9CA3AF] mt-0.5 truncate">{sub}</p>
        {trend && <p className="text-[10px] text-[#C4C4C4] mt-0.5">{trend.label}</p>}
      </div>
    </div>
  );
}

// Card wrapper with title bar
function Card({
  title, icon, action, children, noPad = false,
}: {
  title: string; icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  noPad?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F3F3F3]">
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--primary)' }}>{icon}</span>
          <h3 className="text-[13px] font-semibold text-[#1a1a1a]">{title}</h3>
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className={noPad ? '' : 'p-5'}>{children}</div>
    </div>
  );
}

// Recharts tooltip
function ChartTip({ active, payload, label }: {
  active?: boolean; payload?: { value: number; name: string; color?: string }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E8E8E8] rounded-xl shadow-xl px-3.5 py-2.5 text-xs">
      {label && <p className="font-semibold text-[#374151] mb-1.5">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-[#6B7280]">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span>{p.name}:</span>
          <span className="font-bold text-[#1a1a1a]">{Number(p.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// Skeleton pulse block
function Skel({ className }: { className?: string }) {
  return <div className={`bg-[#F3F3F3] animate-pulse rounded-lg ${className ?? ''}`} />;
}

// Empty state for charts
function Empty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2.5">
      <div className="w-10 h-10 rounded-xl bg-[#F5F5F5] flex items-center justify-center">
        <BarChart2 size={18} className="text-[#D1D5DB]" />
      </div>
      <p className="text-xs text-[#9CA3AF]">{message}</p>
    </div>
  );
}

// Tab button
function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 text-[13px] font-medium rounded-lg transition-all"
      style={active
        ? { backgroundColor: 'var(--primary)', color: '#fff' }
        : { color: '#6B7280', backgroundColor: 'transparent' }
      }
    >
      {label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
function AnalyticsContent() {
  const [data, setData]               = useState<AnalyticsData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError]             = useState(false);
  const [activeTab, setActiveTab]     = useState<'overview' | 'users' | 'content' | 'activity'>('overview');

  const [PRIMARY, setPrimary] = useState(FALLBACK_PRIMARY);
  const [ACCENT,  setAccent]  = useState(FALLBACK_ACCENT);

  useEffect(() => {
    setPrimary(getCssVar('--primary', FALLBACK_PRIMARY));
    setAccent(getCssVar('--accent',  FALLBACK_ACCENT));
  }, []);

  const COLORS = [PRIMARY, ACCENT, '#7B3FA0', '#E91E8C', '#2E7D32', '#F59E0B', '#1565C0', '#E53935'];

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(false);
    try {
      const res = await fetch('/api/admin/analytics');
      if (!res.ok) { setError(true); return; }
      const json: AnalyticsData = await res.json();
      setData(json);
      setLastUpdated(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const id = setInterval(() => fetchData(true), 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const s = data?.summary;
  const userTrend     = s ? trendPct(s.usersThisWeek,  s.usersLastWeek)  : null;
  const activityTrend = s ? trendPct(s.logsThisWeek,   s.logsLastWeek)   : null;
  const pct = (a: number, b: number) => b === 0 ? 0 : Math.round((a / b) * 100);

  const userGrowthFilled     = data ? fillDays(data.userGrowth)     : [];
  const activityGrowthFilled = data ? fillDays(data.activityGrowth) : [];
  const mergedGrowth = userGrowthFilled.map((d, i) => ({
    day:      fmtDay(d.day),
    Users:    d.count,
    Activity: activityGrowthFilled[i]?.count ?? 0,
  }));

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="p-6 lg:p-8 w-full space-y-6">

      {/* ── Page header ──────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)` }}
      >
        {/* decorative circles */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-10 -right-20 w-56 h-56 rounded-full opacity-10 bg-white" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Analytics Overview</h1>
            <div className="flex items-center gap-1.5 mt-1 text-white/70 text-sm">
              <CalendarDays size={13} />
              <span>{today}</span>
            </div>
            {lastUpdated && (
              <p className="text-white/50 text-xs mt-1">
                Last updated {timeAgo(lastUpdated.toISOString())}
              </p>
            )}
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 text-sm font-semibold bg-white/20 hover:bg-white/30 px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 backdrop-blur-sm border border-white/20 self-start sm:self-auto"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────── */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-sm text-red-700 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
          Failed to load analytics data.{' '}
          <button onClick={() => fetchData()} className="underline font-semibold">Retry</button>
        </div>
      )}

      {/* ── Tab switcher ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#E8E8E8] p-1.5 flex items-center gap-1 w-fit">
        {(['overview', 'users', 'content', 'activity'] as const).map((tab) => (
          <Tab
            key={tab}
            label={tab.charAt(0).toUpperCase() + tab.slice(1)}
            active={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          />
        ))}
      </div>

      {/* ── Stat cards row ───────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#E8E8E8] p-5 flex items-center gap-5">
              <Skel className="w-12 h-12 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skel className="w-12 h-6" />
                <Skel className="w-20 h-3" />
                <Skel className="w-16 h-2.5" />
              </div>
            </div>
          ))}
        </div>
      ) : s && (
        <>
          {/* Overview tab — 4 primary cards */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Users"     value={s.totalUsers}     sub={`${s.activeUsers} active · ${s.bannedUsers} banned`}       icon={<Users size={18} />}    iconColor="var(--primary)" trend={userTrend ? { ...userTrend, label: 'vs last 7 days' } : undefined} />
              <StatCard label="Total Pages"     value={s.totalPages}     sub={`${s.publishedPages} published · ${s.draftPages} draft`}    icon={<FileText size={18} />} iconColor="var(--accent)" />
              <StatCard label="Roles"           value={s.totalRoles}     sub={`${s.totalPermissions} permissions total`}                  icon={<Shield size={18} />}   iconColor="#7B3FA0" />
              <StatCard label="Activity Logs"   value={s.totalLogs}      sub={`${s.logsToday} today`}                                     icon={<Activity size={18} />} iconColor="#1565C0" trend={activityTrend ? { ...activityTrend, label: 'vs last 7 days' } : undefined} />
            </div>
          )}
          {/* Users tab — 4 user-focused cards */}
          {activeTab === 'users' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Users"    value={s.totalUsers}    sub="All registered users"                          icon={<Users size={18} />} iconColor="var(--primary)" trend={userTrend ? { ...userTrend, label: 'vs last 7 days' } : undefined} />
              <StatCard label="Active Users"   value={s.activeUsers}   sub={`${pct(s.activeUsers, s.totalUsers)}% of total`}  icon={<Zap size={18} />}   iconColor="#2E7D32" />
              <StatCard label="Inactive Users" value={s.inactiveUsers} sub={`${pct(s.inactiveUsers, s.totalUsers)}% of total`} icon={<Users size={18} />} iconColor="#F59E0B" />
              <StatCard label="Banned Users"   value={s.bannedUsers}   sub="Restricted accounts"                           icon={<Users size={18} />} iconColor="#E53935" />
            </div>
          )}
          {/* Content tab — 4 content-focused cards */}
          {activeTab === 'content' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Pages"     value={s.totalPages}        sub="All pages"                               icon={<FileText size={18} />} iconColor="var(--accent)" />
              <StatCard label="Published"       value={s.publishedPages}    sub={`${pct(s.publishedPages, s.totalPages)}% of total`} icon={<FileText size={18} />} iconColor="#2E7D32" />
              <StatCard label="Drafts"          value={s.draftPages}        sub={`${pct(s.draftPages, s.totalPages)}% of total`}     icon={<FileText size={18} />} iconColor="#F59E0B" />
              <StatCard label="Delete Requests" value={s.pendingDeletes}    sub="Pending review"                          icon={<Users size={18} />}    iconColor="#E53935" />
            </div>
          )}
          {/* Activity tab — 4 activity-focused cards */}
          {activeTab === 'activity' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Logs"  value={s.totalLogs}       sub="All time"              icon={<Activity size={18} />} iconColor="var(--primary)" trend={activityTrend ? { ...activityTrend, label: 'vs last 7 days' } : undefined} />
              <StatCard label="Today"       value={s.logsToday}       sub="Logs today"            icon={<Clock size={18} />}    iconColor="var(--accent)" />
              <StatCard label="This Week"   value={s.logsThisWeek}    sub="Last 7 days"           icon={<Activity size={18} />} iconColor="#7B3FA0" />
              <StatCard label="Permissions" value={s.totalPermissions} sub="System-defined"       icon={<Key size={18} />}      iconColor="#1565C0" />
            </div>
          )}
        </>
      )}

      {/* ── 30-day growth chart (full width) ─────────────────────── */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-[#E8E8E8] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Skel className="w-44 h-5" />
            <Skel className="w-24 h-4" />
          </div>
          <Skel className="w-full h-60" />
        </div>
      ) : (
        <Card
          title="30-Day Growth Trend"
          icon={<TrendingUp size={15} />}
          action={
            <span className="text-[11px] text-[#9CA3AF] bg-[#F9F9F9] px-2.5 py-1 rounded-lg border border-[#F0F0F0]">
              Last 30 days
            </span>
          }
        >
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={mergedGrowth} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gU" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={PRIMARY} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={ACCENT} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                tickLine={false} axisLine={false}
                interval={Math.max(0, Math.floor(mergedGrowth.length / 6) - 1)}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                tickLine={false} axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<ChartTip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 16, color: '#6B7280' }}
                iconType="circle" iconSize={8}
              />
              <Area type="monotone" dataKey="Users"    stroke={PRIMARY} strokeWidth={2.5} fill="url(#gU)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
              <Area type="monotone" dataKey="Activity" stroke={ACCENT}  strokeWidth={2.5} fill="url(#gA)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* ── Activity by Module + Activity by Action ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? (
          <>
            <div className="bg-white rounded-2xl border border-[#E8E8E8] p-5 space-y-3"><Skel className="w-full h-52" /></div>
            <div className="bg-white rounded-2xl border border-[#E8E8E8] p-5 space-y-3"><Skel className="w-full h-52" /></div>
          </>
        ) : (
          <>
            <Card title="Activity by Module" icon={<BarChart2 size={15} />}>
              {!data?.activityByModule.length ? <Empty message="No activity logged yet" /> : (
                <ResponsiveContainer width="100%" height={Math.max(180, data.activityByModule.length * 44)}>
                  <BarChart
                    data={data.activityByModule.map((d) => ({ name: d.module, count: d.count }))}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} width={90} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="count" name="Events" radius={[0, 6, 6, 0]} maxBarSize={24}>
                      {data.activityByModule.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card title="Activity by Action" icon={<BarChart2 size={15} />}>
              {!data?.activityByAction.length ? <Empty message="No activity logged yet" /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={data.activityByAction.map((d) => ({ name: d.action, count: d.count }))}
                    margin={{ top: 0, right: 4, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="count" name="Events" radius={[6, 6, 0, 0]} maxBarSize={40}>
                      {data.activityByAction.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </>
        )}
      </div>

      {/* ── User status + Pages status + Permissions ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {loading ? (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#E8E8E8] p-5 space-y-3">
                <Skel className="w-full h-52" />
              </div>
            ))}
          </>
        ) : (
          <>
            {/* User status donut */}
            <Card title="User Status" icon={<PieIcon size={15} />}>
              {!data?.usersByStatus.length ? <Empty message="No users yet" /> : (
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie
                      data={data.usersByStatus.map((d) => ({ name: d.status, value: d.count }))}
                      cx="50%" cy="46%"
                      innerRadius={52} outerRadius={76}
                      paddingAngle={data.usersByStatus.length > 1 ? 3 : 0}
                      dataKey="value"
                    >
                      {data.usersByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#6B7280' }} iconType="circle" iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Card>

            {/* Pages status donut */}
            <Card title="Pages Status" icon={<PieIcon size={15} />}>
              {!data?.pagesByStatus.length ? <Empty message="No pages yet" /> : (
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie
                      data={data.pagesByStatus.map((d) => ({ name: d.status, value: d.count }))}
                      cx="50%" cy="46%"
                      innerRadius={52} outerRadius={76}
                      paddingAngle={data.pagesByStatus.length > 1 ? 3 : 0}
                      dataKey="value"
                    >
                      {data.pagesByStatus.map((_, i) => <Cell key={i} fill={[PRIMARY, ACCENT, '#2E7D32', '#F59E0B'][i % 4]} />)}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#6B7280' }} iconType="circle" iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Card>

            {/* Permissions by module — progress bars */}
            <Card title="Permissions by Module" icon={<Key size={15} />}>
              {!data?.permissionsByModule.length ? <Empty message="No permissions found" /> : (
                <div className="space-y-3.5">
                  {(() => {
                    const max = Math.max(...data.permissionsByModule.map((x) => x.count), 1);
                    return data.permissionsByModule.map((d, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[12px] text-[#374151] font-medium capitalize">
                            {d.module.replace(/_/g, ' ')}
                          </span>
                          <span
                            className="text-[11px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{ backgroundColor: `${COLORS[i % COLORS.length]}18`, color: COLORS[i % COLORS.length] }}
                          >
                            {d.count}
                          </span>
                        </div>
                        <div className="h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${Math.round((d.count / max) * 100)}%`, backgroundColor: COLORS[i % COLORS.length] }}
                          />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </Card>
          </>
        )}
      </div>

      {/* ── Top active users + Recent activity ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {loading ? (
          <>
            <div className="bg-white rounded-2xl border border-[#E8E8E8] p-5 space-y-3"><Skel className="w-full h-52" /></div>
            <div className="bg-white rounded-2xl border border-[#E8E8E8] p-5 lg:col-span-2 space-y-3"><Skel className="w-full h-52" /></div>
          </>
        ) : (
          <>
            {/* Top active users */}
            <Card title="Most Active Users" icon={<Users size={15} />}>
              {!data?.topActiveUsers.length ? <Empty message="No activity yet" /> : (
                <div className="space-y-3">
                  {(() => {
                    const max = Math.max(...data.topActiveUsers.map((x) => x.count), 1);
                    return data.topActiveUsers.map((u, i) => (
                      <div key={i} className="flex items-center gap-3">
                        {/* Rank badge */}
                        <span className="w-5 text-[11px] font-bold text-[#9CA3AF] flex-shrink-0 text-center">
                          {i + 1}
                        </span>
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                          style={{ background: `linear-gradient(135deg, ${PRIMARY}, ${ACCENT})` }}
                        >
                          {(u.user_name?.[0] ?? '?').toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[12px] font-medium text-[#374151] truncate">{u.user_name}</span>
                            <span className="text-[11px] font-bold ml-2 flex-shrink-0" style={{ color: PRIMARY }}>{u.count}</span>
                          </div>
                          <div className="h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.round((u.count / max) * 100)}%`, background: `linear-gradient(90deg, ${PRIMARY}, ${ACCENT})` }}
                            />
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </Card>

            {/* Recent activity feed */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F3F3F3]">
                <div className="flex items-center gap-2">
                  <Clock size={15} style={{ color: 'var(--primary)' }} />
                  <h3 className="text-[13px] font-semibold text-[#1a1a1a]">Recent Activity</h3>
                </div>
                <a
                  href="/admin/activity-logs"
                  className="flex items-center gap-1 text-[11px] font-semibold transition-colors hover:opacity-80"
                  style={{ color: 'var(--primary)' }}
                >
                  View all <ArrowUpRight size={11} />
                </a>
              </div>
              {!data?.recentActivity.length ? (
                <div className="px-5 py-12 text-center text-xs text-[#9CA3AF]">No activity logged yet</div>
              ) : (
                <div className="divide-y divide-[#F7F7F7]">
                  {data.recentActivity.map((log) => (
                    <div key={log.id} className="px-5 py-3 flex items-start gap-3 hover:bg-[#FAFAFA] transition-colors">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5"
                        style={{ background: `linear-gradient(135deg, ${PRIMARY}, ${ACCENT})` }}
                      >
                        {(log.user_name?.[0] ?? '?').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-[#374151] leading-snug">
                          <span className="font-semibold text-[#1a1a1a]">{log.user_name}</span>{' '}
                          <span className="font-medium" style={{ color: ACCENT }}>{log.action}</span>
                          {log.target_name && <> <span className="text-[#374151]">{log.target_name}</span></>}{' '}
                          <span className="text-[#9CA3AF]">in {log.module}</span>
                        </p>
                        {log.description && (
                          <p className="text-[11px] text-[#9CA3AF] mt-0.5 truncate">{log.description}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-[#C4C4C4] flex-shrink-0 mt-0.5 whitespace-nowrap">
                        {timeAgo(log.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

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
