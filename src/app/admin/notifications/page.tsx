'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Plus, Search, Bell, Send, Clock, FileText, XCircle,
  ChevronLeft, ChevronRight, Inbox, Trash2, Eye,
  Filter, RefreshCw, CheckCircle2, AlertCircle, Loader2,
  Megaphone, Pencil,
} from 'lucide-react';
import PermissionGuard from '@/components/admin/PermissionGuard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationRow {
  id: number;
  title: string;
  body: string;
  category_id: number | null;
  category_name: string | null;
  category_color: string | null;
  audience_type: string;
  audience_filters: Record<string, unknown>;
  estimated_recipients: number;
  actual_recipients: number;
  delivered_count: number;
  failed_count: number;
  priority: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  created_by_name: string | null;
  created_at: string;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string; icon: React.ReactNode }> = {
  draft:     { label: 'Draft',     dot: 'bg-[#757575]',  text: 'text-[#757575]',  bg: 'bg-[#F9F9F9]',  icon: <FileText size={11} /> },
  scheduled: { label: 'Scheduled', dot: 'bg-amber-400',  text: 'text-amber-700',  bg: 'bg-amber-50',   icon: <Clock size={11} /> },
  sending:   { label: 'Sending',   dot: 'bg-blue-400',   text: 'text-blue-700',   bg: 'bg-blue-50',    icon: <Loader2 size={11} className="animate-spin" /> },
  sent:      { label: 'Sent',      dot: 'bg-[#2E7D32]',  text: 'text-[#2E7D32]', bg: 'bg-green-50',   icon: <CheckCircle2 size={11} /> },
  failed:    { label: 'Failed',    dot: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50',     icon: <AlertCircle size={11} /> },
  cancelled: { label: 'Cancelled', dot: 'bg-rose-400',   text: 'text-rose-700',   bg: 'bg-rose-50',    icon: <XCircle size={11} /> },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low:    { label: 'Low',    color: '#9CA3AF' },
  normal: { label: 'Normal', color: '#6B9BFA' },
  high:   { label: 'High',   color: '#C77878' },
};

const AUDIENCE_LABELS: Record<string, string> = {
  all:           'All Users',
  partner:       'Partners',
  partner_type:  'Partner Type',
  specific_user: 'Specific Users',
  category:      'By Category',
  role:          'By Role',
  custom:        'Custom',
};

const STATUS_TABS = ['all', 'draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'] as const;
type StatusTab = typeof STATUS_TABS[number];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [sending, setSending] = useState<number | null>(null);
  const limit = 10;

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search,
        status: statusTab === 'all' ? '' : statusTab,
      });
      const res = await fetch(`/api/admin/push-notifications?${params}`);
      const data = await res.json();
      if (res.ok) {
        setNotifications(data.notifications);
        setTotal(data.total);
      } else {
        toast.error(data.error || 'Failed to load notifications');
      }
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusTab]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const switchTab = (t: StatusTab) => { setStatusTab(t); setPage(1); };

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Delete notification "${title}"?`)) return;
    setDeleting(id);
    try {
      const res = await fetch('/api/admin/push-notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (res.ok) { toast.success('Notification deleted'); fetchNotifications(); }
      else toast.error(data.error || 'Delete failed');
    } catch { toast.error('Delete failed'); }
    finally { setDeleting(null); }
  };

  const handleSendNow = async (id: number, title: string) => {
    if (!confirm(`Send notification "${title}" now to all targeted recipients?`)) return;
    setSending(id);
    try {
      const res = await fetch('/api/admin/push-notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'send' }),
      });
      const data = await res.json();
      if (res.ok) { toast.success('Notification is being sent!'); fetchNotifications(); }
      else toast.error(data.error || 'Send failed');
    } catch { toast.error('Send failed'); }
    finally { setSending(null); }
  };

  const handleCancel = async (id: number, title: string) => {
    if (!confirm(`Cancel scheduled notification "${title}"?`)) return;
    try {
      const res = await fetch('/api/admin/push-notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'cancel' }),
      });
      const data = await res.json();
      if (res.ok) { toast.success('Notification cancelled'); fetchNotifications(); }
      else toast.error(data.error || 'Cancel failed');
    } catch { toast.error('Cancel failed'); }
  };

  const totalPages = Math.ceil(total / limit);

  const tabCounts: Record<string, number> = {};
  // We'll just show the total on the 'all' tab

  return (
    <PermissionGuard permission="notifications.view">
      <div className="p-6 lg:p-8 w-full">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#2D2D2D] tracking-tight">Notifications</h1>
            <p className="text-[#757575] text-sm mt-1">
              {total} notification{total !== 1 ? 's' : ''} · push & in-app campaigns
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchNotifications}
              className="p-2.5 text-[#757575] hover:bg-[var(--light-purple)] rounded-xl transition-all border border-[#E0E0E0]"
              title="Refresh"
            >
              <RefreshCw size={15} />
            </button>
            <Link
              href="/admin/notifications/new"
              className="inline-flex items-center gap-2 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm hover:-translate-y-px"
              style={{ backgroundColor: 'var(--primary)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--primary-dark)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--primary)')}
            >
              <Plus size={15} />
              New Notification
            </Link>
          </div>
        </div>

        {/* ── Status Tabs + Search ────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          {/* Status tabs */}
          <div className="flex items-center gap-0.5 bg-[var(--light-purple)] p-1 rounded-xl flex-shrink-0 overflow-x-auto">
            {STATUS_TABS.map((tab) => {
              const cfg = STATUS_CONFIG[tab];
              return (
                <button
                  key={tab}
                  onClick={() => switchTab(tab)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap`}
                  style={
                    statusTab === tab
                      ? { backgroundColor: 'white', color: 'var(--primary)', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }
                      : { color: '#757575' }
                  }
                >
                  {tab === 'all' ? <Bell size={12} /> : cfg?.icon}
                  {tab === 'all' ? 'All' : cfg?.label}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#757575]" />
            <input
              type="text"
              placeholder="Search by title or message…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#757575] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* ── Table ──────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-[#E0E0E0] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E0E0E0]">
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5 w-10">Sr.</th>
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5">Notification</th>
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5 hidden md:table-cell">Audience</th>
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5 hidden lg:table-cell">Recipients</th>
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5 hidden xl:table-cell">Scheduled / Sent</th>
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5">Status</th>
                  <th className="text-right text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-[#F9F9F9]">
                      <td className="px-6 py-4"><div className="h-3 bg-[var(--light-purple)] rounded w-6 animate-pulse" /></td>
                      <td className="px-6 py-4">
                        <div className="space-y-1.5">
                          <div className="h-3 bg-[var(--light-purple)] rounded w-48 animate-pulse" />
                          <div className="h-2.5 bg-[var(--light-purple)] rounded w-64 animate-pulse" />
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell"><div className="h-5 bg-[var(--light-purple)] rounded-full w-20 animate-pulse" /></td>
                      <td className="px-6 py-4 hidden lg:table-cell"><div className="h-3 bg-[var(--light-purple)] rounded w-12 animate-pulse" /></td>
                      <td className="px-6 py-4 hidden xl:table-cell"><div className="h-3 bg-[var(--light-purple)] rounded w-28 animate-pulse" /></td>
                      <td className="px-6 py-4"><div className="h-5 bg-[var(--light-purple)] rounded-full w-16 animate-pulse" /></td>
                      <td className="px-6 py-4"><div className="h-7 bg-[var(--light-purple)] rounded w-16 ml-auto animate-pulse" /></td>
                    </tr>
                  ))
                ) : notifications.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="w-14 h-14 bg-[var(--light-purple)] rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Megaphone size={24} style={{ color: 'var(--primary)' }} />
                      </div>
                      <p className="text-[#757575] font-medium text-sm">No notifications found</p>
                      <Link
                        href="/admin/notifications/new"
                        className="text-sm hover:underline mt-1.5 inline-block"
                        style={{ color: 'var(--primary)' }}
                      >
                        Create your first notification →
                      </Link>
                    </td>
                  </tr>
                ) : (
                  notifications.map((n, index) => {
                    const srNo = (page - 1) * limit + index + 1;
                    const statusCfg = STATUS_CONFIG[n.status] || STATUS_CONFIG.draft;
                    const priorityCfg = PRIORITY_CONFIG[n.priority] || PRIORITY_CONFIG.normal;
                    const canDelete = ['draft', 'cancelled', 'failed'].includes(n.status);
                    const canSend = ['draft', 'scheduled'].includes(n.status);
                    const canCancel = ['scheduled', 'draft'].includes(n.status);

                    return (
                      <tr
                        key={n.id}
                        className="border-b border-[#F9F9F9] last:border-0 hover:bg-[#F9F9F9]/60 transition-colors"
                      >
                        {/* Sr. */}
                        <td className="px-6 py-4">
                          <span className="text-xs font-medium text-[#757575]">{srNo}</span>
                        </td>

                        {/* Notification title + body */}
                        <td className="px-6 py-4">
                          <div className="flex items-start gap-3">
                            {/* Category color dot */}
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                              style={{ backgroundColor: n.category_color || '#9CA3AF' }}
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[#2D2D2D] leading-snug truncate max-w-[220px]">
                                {n.title}
                              </p>
                              <p className="text-xs text-[#757575] mt-0.5 truncate max-w-[220px]">
                                {n.body}
                              </p>
                              {n.category_name && (
                                <span
                                  className="inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                                  style={{
                                    backgroundColor: `${n.category_color}20`,
                                    color: n.category_color || '#757575',
                                  }}
                                >
                                  {n.category_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Audience */}
                        <td className="px-6 py-4 hidden md:table-cell">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--light-purple)] text-[#2D2D2D] text-xs font-medium rounded-full">
                            <Filter size={10} />
                            {AUDIENCE_LABELS[n.audience_type] || n.audience_type}
                          </span>
                        </td>

                        {/* Recipients */}
                        <td className="px-6 py-4 hidden lg:table-cell">
                          <div className="text-sm">
                            {n.status === 'sent' ? (
                              <div>
                                <span className="font-semibold text-[#2D2D2D]">{n.actual_recipients.toLocaleString()}</span>
                                <span className="text-[#757575] text-xs"> sent</span>
                                {n.delivered_count > 0 && (
                                  <p className="text-[10px] text-[#2E7D32]">{n.delivered_count} delivered</p>
                                )}
                              </div>
                            ) : (
                              <div>
                                <span className="font-semibold text-[#2D2D2D]">~{n.estimated_recipients.toLocaleString()}</span>
                                <span className="text-[#757575] text-xs"> est.</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Scheduled / Sent date */}
                        <td className="px-6 py-4 hidden xl:table-cell">
                          <div className="text-xs text-[#757575]">
                            {n.sent_at ? (
                              <span>Sent {new Date(n.sent_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}</span>
                            ) : n.scheduled_at ? (
                              <span className="text-amber-600">
                                Sched. {new Date(n.scheduled_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })}
                                {' '}
                                {new Date(n.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                              </span>
                            ) : (
                              <span className="text-[#bdbdbd]">—</span>
                            )}
                          </div>
                        </td>

                        {/* Status badge */}
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusCfg.bg} ${statusCfg.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusCfg.dot}`} />
                            {statusCfg.label}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            {/* View */}
                            <Link
                              href={`/admin/notifications/${n.id}`}
                              className="p-2 text-[#757575] hover:bg-[var(--light-purple)] rounded-lg transition-all"
                              onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                              onMouseLeave={e => (e.currentTarget.style.color = '#757575')}
                              title="View details"
                            >
                              <Eye size={14} />
                            </Link>

                            {/* Edit — only draft/scheduled */}
                            {['draft', 'scheduled'].includes(n.status) && (
                              <Link
                                href={`/admin/notifications/new?edit=${n.id}`}
                                className="p-2 text-[#757575] hover:bg-[var(--light-purple)] rounded-lg transition-all"
                                onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                                onMouseLeave={e => (e.currentTarget.style.color = '#757575')}
                                title="Edit notification"
                              >
                                <Pencil size={14} />
                              </Link>
                            )}

                            {/* Send now */}
                            {canSend && (
                              <button
                                onClick={() => handleSendNow(n.id, n.title)}
                                disabled={sending === n.id}
                                className="p-2 text-[#757575] hover:text-[#2E7D32] hover:bg-green-50 rounded-lg transition-all disabled:opacity-40"
                                title="Send now"
                              >
                                {sending === n.id
                                  ? <Loader2 size={14} className="animate-spin" />
                                  : <Send size={14} />
                                }
                              </button>
                            )}

                            {/* Cancel scheduled */}
                            {n.status === 'scheduled' && (
                              <button
                                onClick={() => handleCancel(n.id, n.title)}
                                className="p-2 text-[#757575] hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                title="Cancel scheduled"
                              >
                                <XCircle size={14} />
                              </button>
                            )}

                            {/* Delete */}
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(n.id, n.title)}
                                disabled={deleting === n.id}
                                className="p-2 text-[#757575] hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-40"
                                title="Delete"
                              >
                                {deleting === n.id
                                  ? <Loader2 size={14} className="animate-spin" />
                                  : <Trash2 size={14} />
                                }
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-[#F9F9F9] flex items-center justify-between">
              <p className="text-xs text-[#757575]">
                Showing{' '}
                <span className="font-medium text-[#2D2D2D]">
                  {(page - 1) * limit + 1}–{Math.min(page * limit, total)}
                </span>{' '}
                of{' '}
                <span className="font-medium text-[#2D2D2D]">{total}</span>
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
    </PermissionGuard>
  );
}
