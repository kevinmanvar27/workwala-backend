'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Activity, Search, Trash2, RefreshCw, Filter,
  User, Shield, FileText, Settings, Key, LogIn, ChevronLeft, ChevronRight,
} from 'lucide-react';
import PermissionGuard from '@/components/admin/PermissionGuard';
import { apiFetch } from '@/lib/apiFetch';

interface ActivityLog {
  id: number;
  user_id: number | null;
  user_name: string;
  action: string;
  module: string;
  target_id: number | null;
  target_name: string | null;
  description: string | null;
  ip_address: string | null;
  created_at: string;
}

// Module icon + color mapping — use CSS vars for brand colors
const MODULE_META: Record<string, { icon: React.ReactNode; bg: string; text: string }> = {
  users:         { icon: <User size={13} />,     bg: 'bg-[var(--light-purple)]', text: 'text-[var(--primary)]' },
  roles:         { icon: <Shield size={13} />,   bg: 'bg-[color-mix(in_srgb,var(--accent)_12%,white)]', text: 'text-[var(--accent)]' },
  permissions:   { icon: <Key size={13} />,      bg: 'bg-[var(--light-purple)]', text: 'text-[var(--primary-dark)]' },
  pages:         { icon: <FileText size={13} />, bg: 'bg-green-50',  text: 'text-[#2E7D32]' },
  settings:      { icon: <Settings size={13} />, bg: 'bg-amber-50',  text: 'text-amber-700' },
  auth:          { icon: <LogIn size={13} />,    bg: 'bg-[var(--light-purple)]', text: 'text-[var(--primary)]' },
  activity_logs: { icon: <Activity size={13} />, bg: 'bg-[color-mix(in_srgb,var(--accent)_12%,white)]', text: 'text-[var(--accent)]' },
};
const defaultMeta = { icon: <Activity size={13} />, bg: 'bg-[#F9F9F9]', text: 'text-[#757575]' };

// Action badge color — brand colors via CSS vars
const ACTION_COLOR: Record<string, string> = {
  Created:  'bg-green-50 text-[#2E7D32]',
  Updated:  'bg-[var(--light-purple)] text-[var(--primary)]',
  Deleted:  'bg-red-50 text-red-700',
  Restored: 'bg-amber-50 text-amber-700',
  Login:    'bg-[color-mix(in_srgb,var(--accent)_12%,white)] text-[var(--accent)]',
  Logout:   'bg-[#F9F9F9] text-[#757575]',
  Cleared:  'bg-red-50 text-red-700',
};
const defaultActionColor = 'bg-[#F9F9F9] text-[#757575]';

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' })
    + ' · '
    + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

/** Display IP in a human-readable way — local loopback shown as "localhost" */
function formatIp(ip: string | null): string {
  if (!ip) return '—';
  if (ip === '127.0.0.1' || ip === '::1') return 'localhost';
  return ip;
}

function ActivityLogsContent() {
  const [logs, setLogs]           = useState<ActivityLog[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [clearing, setClearing]   = useState(false);
  const [search, setSearch]       = useState('');
  const [moduleFilter, setModule] = useState('');
  const [actionFilter, setAction] = useState('');
  const [modules, setModules]     = useState<string[]>([]);
  const [actions, setActions]     = useState<string[]>([]);
  const [canDelete, setCanDelete] = useState(false);

  const LIMIT = 20;
  const totalPages = Math.ceil(total / LIMIT);

  const fetchLogs = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p), limit: String(LIMIT),
        ...(search       ? { search }              : {}),
        ...(moduleFilter ? { module: moduleFilter } : {}),
        ...(actionFilter ? { action: actionFilter } : {}),
      });
      const [logsRes, meRes] = await Promise.all([
        fetch(`/api/admin/activity-logs?${params}`).then((r) => r.json()),
        fetch('/api/auth/me').then((r) => r.json()),
      ]);
      setLogs(logsRes.logs || []);
      setTotal(logsRes.total || 0);
      if (logsRes.modules) setModules(logsRes.modules);
      if (logsRes.actions) setActions(logsRes.actions);
      if (Array.isArray(meRes.permissions)) {
        setCanDelete(meRes.permissions.includes('activity_logs.delete'));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, search, moduleFilter, actionFilter]);

  // Refetch when filters change, reset to page 1
  useEffect(() => {
    setPage(1);
  }, [search, moduleFilter, actionFilter]);

  useEffect(() => {
    fetchLogs(page);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, moduleFilter, actionFilter]);

  const handleClear = async () => {
    if (!confirm('Clear all activity logs? This cannot be undone.')) return;
    setClearing(true);
    try {
      await apiFetch('/api/admin/activity-logs', { method: 'DELETE' });
      setLogs([]);
      setTotal(0);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 w-full">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#2D2D2D] tracking-tight">Activity Logs</h1>
          <p className="text-[#757575] text-sm mt-1">
            {total} event{total !== 1 ? 's' : ''} recorded
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLogs(page)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E0E0E0] bg-white text-[#757575] hover:text-[#2D2D2D] hover:border-[#bdbdbd] text-sm font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          {canDelete && (
            <button
              onClick={handleClear}
              disabled={clearing || logs.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-sm font-medium transition-all disabled:opacity-50"
            >
              <Trash2 size={14} />
              {clearing ? 'Clearing…' : 'Clear All'}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-[#E0E0E0] p-4 mb-5 flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl px-3 py-2">
          <Search size={14} className="text-[#757575] flex-shrink-0" />
          <input
            type="text"
            placeholder="Search user, action, target…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-[#2D2D2D] placeholder:text-[#bdbdbd] outline-none w-full"
          />
        </div>

        {/* Module filter */}
        <div className="flex items-center gap-2 bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl px-3 py-2">
          <Filter size={13} className="text-[#757575]" />
          <select
            value={moduleFilter}
            onChange={(e) => setModule(e.target.value)}
            className="bg-transparent text-sm text-[#2D2D2D] outline-none cursor-pointer"
          >
            <option value="">All Modules</option>
            {modules.map((m) => (
              <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1).replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        {/* Action filter */}
        <div className="flex items-center gap-2 bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl px-3 py-2">
          <Activity size={13} className="text-[#757575]" />
          <select
            value={actionFilter}
            onChange={(e) => setAction(e.target.value)}
            className="bg-transparent text-sm text-[#2D2D2D] outline-none cursor-pointer"
          >
            <option value="">All Actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        {/* Clear filters */}
        {(search || moduleFilter || actionFilter) && (
          <button
            onClick={() => { setSearch(''); setModule(''); setAction(''); }}
            className="text-xs text-[#757575] hover:text-[var(--accent)] transition-colors font-medium"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E0E0E0] overflow-hidden">
        {loading ? (
          <div className="divide-y divide-[#F9F9F9]">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                <div className="w-8 h-8 rounded-xl bg-[var(--light-purple)] flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-[var(--light-purple)] rounded w-48" />
                  <div className="h-3 bg-[var(--light-purple)] rounded w-72" />
                </div>
                <div className="w-16 h-5 bg-[var(--light-purple)] rounded-full" />
                <div className="w-28 h-3 bg-[var(--light-purple)] rounded hidden sm:block" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-14 h-14 bg-[var(--light-purple)] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Activity size={24} style={{ color: 'var(--primary)' }} />
            </div>
            <p className="text-[#2D2D2D] font-semibold text-sm">No activity logs found</p>
            <p className="text-[#757575] text-xs mt-1">
              {search || moduleFilter || actionFilter ? 'Try adjusting your filters.' : 'Activity will appear here as actions are performed.'}
            </p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-3 border-b border-[#F9F9F9] bg-[#F9F9F9]">
              <span className="text-[11px] font-semibold text-[#757575] uppercase tracking-wider">Actor / Target</span>
              <span className="text-[11px] font-semibold text-[#757575] uppercase tracking-wider">Module</span>
              <span className="text-[11px] font-semibold text-[#757575] uppercase tracking-wider">Action</span>
              <span className="text-[11px] font-semibold text-[#757575] uppercase tracking-wider">IP Address</span>
              <span className="text-[11px] font-semibold text-[#757575] uppercase tracking-wider">Time</span>
            </div>

            <div className="divide-y divide-[#F9F9F9]">
              {logs.map((log) => {
                const meta        = MODULE_META[log.module] || defaultMeta;
                const actionColor = ACTION_COLOR[log.action] || defaultActionColor;
                return (
                  <div
                    key={log.id}
                    className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-2 sm:gap-4 px-6 py-4 hover:bg-[#F9F9F9]/60 transition-colors"
                  >
                    {/* Actor + target */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.bg} ${meta.text}`}>
                        {meta.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#2D2D2D] leading-none truncate">
                          {log.user_name}
                        </p>
                        {(log.target_name || log.description) && (
                          <p className="text-xs text-[#757575] mt-0.5 truncate">
                            {log.target_name ? `→ ${log.target_name}` : ''}{log.description ? ` · ${log.description}` : ''}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Module */}
                    <div className="flex items-center sm:block">
                      <span className="sm:hidden text-[10px] font-bold text-[#bdbdbd] uppercase mr-2">Module</span>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.bg} ${meta.text}`}>
                        {meta.icon}
                        <span className="capitalize">{log.module.replace('_', ' ')}</span>
                      </span>
                    </div>

                    {/* Action */}
                    <div className="flex items-center sm:block">
                      <span className="sm:hidden text-[10px] font-bold text-[#bdbdbd] uppercase mr-2">Action</span>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${actionColor}`}>
                        {log.action}
                      </span>
                    </div>

                    {/* IP */}
                    <div className="flex items-center sm:block">
                      <span className="sm:hidden text-[10px] font-bold text-[#bdbdbd] uppercase mr-2">IP</span>
                      <span className="text-xs text-[#757575] font-mono">{formatIp(log.ip_address)}</span>
                    </div>

                    {/* Time */}
                    <div className="flex items-center sm:block">
                      <span className="sm:hidden text-[10px] font-bold text-[#bdbdbd] uppercase mr-2">Time</span>
                      <span className="text-xs text-[#757575]">{formatDate(log.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-between">
          <p className="text-xs text-[#757575]">
            Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-[#E0E0E0] bg-white text-[#757575] hover:text-[#2D2D2D] hover:border-[#bdbdbd] disabled:opacity-40 transition-all"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              // Show pages around current
              let p: number;
              if (totalPages <= 5) p = i + 1;
              else if (page <= 3) p = i + 1;
              else if (page >= totalPages - 2) p = totalPages - 4 + i;
              else p = page - 2 + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                    p === page
                      ? 'text-white'
                      : 'border border-[#E0E0E0] bg-white text-[#757575] hover:border-[#bdbdbd] hover:text-[#2D2D2D]'
                  }`}
                  style={p === page ? { backgroundColor: 'var(--primary)' } : undefined}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg border border-[#E0E0E0] bg-white text-[#757575] hover:text-[#2D2D2D] hover:border-[#bdbdbd] disabled:opacity-40 transition-all"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ActivityLogsPage() {
  return (
    <PermissionGuard permission="activity_logs.view">
      <ActivityLogsContent />
    </PermissionGuard>
  );
}
