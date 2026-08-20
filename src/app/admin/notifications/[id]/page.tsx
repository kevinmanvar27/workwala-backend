'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Bell, Send, Clock, FileText, XCircle,
  Users, CheckCircle2, AlertCircle, Loader2, Eye,
  Calendar, User, Megaphone, BarChart3, RefreshCw,
  Link2, Image, Tag, Filter, Copy, Trash2, Pencil,
} from 'lucide-react';
import PermissionGuard from '@/components/admin/PermissionGuard';
import { apiFetch } from '@/lib/apiFetch';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationDetail {
  id: number;
  title: string;
  body: string;
  category_id: number | null;
  category_name: string | null;
  category_color: string | null;
  image_url: string | null;
  action_url: string | null;
  audience_type: string;
  audience_filters: Record<string, unknown>;
  estimated_recipients: number;
  actual_recipients: number;
  delivered_count: number;
  failed_count: number;
  opened_count: number;
  clicked_count: number;
  priority: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  channels: string[];
  notes: string | null;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

interface DeliverySummary {
  status: string;
  count: number;
}

interface RecentLog {
  id: number;
  recipient_type: string;
  recipient_id: number;
  recipient_name: string | null;
  status: string;
  error_message: string | null;
  sent_at: string | null;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  draft:     { label: 'Draft',     dot: 'bg-[#757575]',  text: 'text-[#757575]',  bg: 'bg-[#F9F9F9]' },
  scheduled: { label: 'Scheduled', dot: 'bg-amber-400',  text: 'text-amber-700',  bg: 'bg-amber-50' },
  sending:   { label: 'Sending',   dot: 'bg-blue-400',   text: 'text-blue-700',   bg: 'bg-blue-50' },
  sent:      { label: 'Sent',      dot: 'bg-[#2E7D32]',  text: 'text-[#2E7D32]', bg: 'bg-green-50' },
  failed:    { label: 'Failed',    dot: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50' },
  cancelled: { label: 'Cancelled', dot: 'bg-rose-400',   text: 'text-rose-700',   bg: 'bg-rose-50' },
};

const LOG_STATUS_CONFIG: Record<string, { text: string; bg: string }> = {
  pending:   { text: 'text-[#757575]',  bg: 'bg-[#F9F9F9]' },
  sent:      { text: 'text-[#2E7D32]',  bg: 'bg-green-50' },
  delivered: { text: 'text-blue-700',   bg: 'bg-blue-50' },
  failed:    { text: 'text-red-700',    bg: 'bg-red-50' },
  opened:    { text: 'text-purple-700', bg: 'bg-purple-50' },
  clicked:   { text: 'text-amber-700',  bg: 'bg-amber-50' },
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

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#E0E0E0] p-4">
      <p className="text-[11px] font-semibold text-[#757575] uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color }}>{value.toLocaleString()}</p>
      {sub && <p className="text-[11px] text-[#bdbdbd] mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NotificationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [notif, setNotif] = useState<NotificationDetail | null>(null);
  const [deliverySummary, setDeliverySummary] = useState<DeliverySummary[]>([]);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/push-notifications/${id}`);
      const data = await res.json();
      if (res.ok) {
        setNotif(data.notification);
        setDeliverySummary(data.delivery_summary || []);
        setRecentLogs(data.recent_logs || []);
      } else {
        toast.error(data.error || 'Failed to load notification');
        router.push('/admin/notifications');
      }
    } catch {
      toast.error('Failed to load notification');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleSendNow = async () => {
    if (!notif) return;
    if (!confirm(`Send "${notif.title}" now to all targeted recipients?`)) return;
    setActionLoading(true);
    try {
      const res = await apiFetch('/api/admin/push-notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notif.id, action: 'send' }),
      });
      const data = await res.json();
      if (res.ok) { toast.success('Notification is being sent!'); fetchDetail(); }
      else toast.error(data.error || 'Send failed');
    } catch { toast.error('Send failed'); }
    finally { setActionLoading(false); }
  };

  const handleCancel = async () => {
    if (!notif) return;
    if (!confirm(`Cancel scheduled notification "${notif.title}"?`)) return;
    setActionLoading(true);
    try {
      const res = await apiFetch('/api/admin/push-notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notif.id, action: 'cancel' }),
      });
      const data = await res.json();
      if (res.ok) { toast.success('Notification cancelled'); fetchDetail(); }
      else toast.error(data.error || 'Cancel failed');
    } catch { toast.error('Cancel failed'); }
    finally { setActionLoading(false); }
  };

  const handleDelete = async () => {
    if (!notif) return;
    if (!confirm(`Delete notification "${notif.title}"? This cannot be undone.`)) return;
    setActionLoading(true);
    try {
      const res = await apiFetch('/api/admin/push-notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notif.id }),
      });
      const data = await res.json();
      if (res.ok) { toast.success('Notification deleted'); router.push('/admin/notifications'); }
      else toast.error(data.error || 'Delete failed');
    } catch { toast.error('Delete failed'); }
    finally { setActionLoading(false); }
  };

  if (loading) {
    return (
      <PermissionGuard permission="notifications.view">
        <div className="p-6 lg:p-8 w-full space-y-5 animate-pulse">
          <div className="h-8 bg-[var(--light-purple)] rounded-xl w-48" />
          <div className="h-48 bg-[var(--light-purple)] rounded-2xl" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-[var(--light-purple)] rounded-xl" />
            ))}
          </div>
        </div>
      </PermissionGuard>
    );
  }

  if (!notif) return null;

  const statusCfg = STATUS_CONFIG[notif.status] || STATUS_CONFIG.draft;
  const canEdit = ['draft', 'scheduled'].includes(notif.status);
  const canSend = ['draft', 'scheduled'].includes(notif.status);
  const canCancel = ['scheduled', 'draft'].includes(notif.status);
  const canDelete = ['draft', 'cancelled', 'failed'].includes(notif.status);

  // Delivery rate
  const deliveryRate = notif.actual_recipients > 0
    ? Math.round((notif.delivered_count / notif.actual_recipients) * 100)
    : 0;

  return (
    <PermissionGuard permission="notifications.view">
      <div className="p-6 lg:p-8 w-full">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/notifications')}
              className="p-2 text-[#757575] hover:bg-[var(--light-purple)] rounded-xl transition-all border border-[#E0E0E0]"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-[#2D2D2D] tracking-tight truncate max-w-[400px]">
                  {notif.title}
                </h1>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusCfg.bg} ${statusCfg.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusCfg.dot}`} />
                  {statusCfg.label}
                </span>
              </div>
              <p className="text-[#757575] text-sm mt-0.5">
                Created by {notif.created_by_name || 'Unknown'} · {new Date(notif.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={fetchDetail}
              className="p-2 text-[#757575] hover:bg-[var(--light-purple)] rounded-xl transition-all border border-[#E0E0E0]"
              title="Refresh"
            >
              <RefreshCw size={15} />
            </button>
            {canEdit && (
              <Link
                href={`/admin/notifications/new?edit=${notif.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-[#E0E0E0] text-[#2D2D2D] hover:bg-[var(--light-purple)] transition-all"
              >
                <Pencil size={14} />
                Edit
              </Link>
            )}
            {canSend && (
              <button
                onClick={handleSendNow}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#2E7D32' }}
              >
                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Send Now
              </button>
            )}
            {canCancel && (
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-all disabled:opacity-60"
              >
                <XCircle size={14} />
                Cancel
              </button>
            )}
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="p-2 text-[#757575] hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-[#E0E0E0] disabled:opacity-60"
                title="Delete"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left: Content + Audience ────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Notification Preview Card */}
            <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-[#F0F0F0] flex items-center gap-2.5">
                <Megaphone size={16} style={{ color: 'var(--primary)' }} />
                <h2 className="text-sm font-bold text-[#2D2D2D]">Notification Content</h2>
              </div>
              <div className="px-6 py-5">
                {/* Phone-style preview */}
                <div className="bg-[#F9F9F9] rounded-xl p-4 border border-[#E0E0E0] mb-5">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: notif.category_color ? `${notif.category_color}20` : 'var(--light-purple)',
                      }}
                    >
                      <Bell size={16} style={{ color: notif.category_color || 'var(--primary)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#2D2D2D] leading-snug">{notif.title}</p>
                      <p className="text-xs text-[#757575] mt-1 leading-relaxed">{notif.body}</p>
                      {notif.image_url && (
                        <img
                          src={notif.image_url}
                          alt="Notification"
                          className="mt-2 rounded-lg max-h-32 object-cover w-full"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Fields */}
                <div className="space-y-3">
                  {notif.category_name && (
                    <InfoRow icon={<Tag size={13} />} label="Category">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: `${notif.category_color}20`,
                          color: notif.category_color || '#757575',
                        }}
                      >
                        {notif.category_name}
                      </span>
                    </InfoRow>
                  )}
                  {notif.action_url && (
                    <InfoRow icon={<Link2 size={13} />} label="Action URL">
                      <span className="text-xs font-mono text-blue-600 truncate max-w-[200px]">{notif.action_url}</span>
                    </InfoRow>
                  )}
                  <InfoRow icon={<Bell size={13} />} label="Priority">
                    <span className="text-xs font-semibold capitalize">{notif.priority}</span>
                  </InfoRow>
                  <InfoRow icon={<Bell size={13} />} label="Channels">
                    <span className="text-xs text-[#2D2D2D]">{notif.channels.join(', ')}</span>
                  </InfoRow>
                  {notif.notes && (
                    <InfoRow icon={<FileText size={13} />} label="Notes">
                      <span className="text-xs text-[#757575]">{notif.notes}</span>
                    </InfoRow>
                  )}
                </div>
              </div>
            </div>

            {/* Delivery Stats (only for sent/sending) */}
            {['sent', 'sending', 'failed'].includes(notif.status) && (
              <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[#F0F0F0] flex items-center gap-2.5">
                  <BarChart3 size={16} style={{ color: 'var(--primary)' }} />
                  <h2 className="text-sm font-bold text-[#2D2D2D]">Delivery Statistics</h2>
                </div>
                <div className="px-6 py-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                    <StatCard label="Sent To" value={notif.actual_recipients} color="var(--primary)" />
                    <StatCard label="Delivered" value={notif.delivered_count} sub={`${deliveryRate}% rate`} color="#2E7D32" />
                    <StatCard label="Failed" value={notif.failed_count} color="#C77878" />
                    <StatCard label="Opened" value={notif.opened_count} color="#8B5CF6" />
                  </div>

                  {/* Delivery progress bar */}
                  {notif.actual_recipients > 0 && (
                    <div>
                      <div className="flex items-center justify-between text-xs text-[#757575] mb-1.5">
                        <span>Delivery rate</span>
                        <span className="font-semibold text-[#2D2D2D]">{deliveryRate}%</span>
                      </div>
                      <div className="h-2 bg-[#F0F0F0] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${deliveryRate}%`,
                            backgroundColor: deliveryRate > 70 ? '#2E7D32' : deliveryRate > 40 ? '#D9A05B' : '#C77878',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recent Delivery Logs */}
            {recentLogs.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[#F0F0F0] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Users size={16} style={{ color: 'var(--primary)' }} />
                    <h2 className="text-sm font-bold text-[#2D2D2D]">Recent Recipients</h2>
                  </div>
                  <span className="text-xs text-[#757575]">Last {recentLogs.length}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#F0F0F0]">
                        <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3">Recipient</th>
                        <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3">Type</th>
                        <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3">Status</th>
                        <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3 hidden md:table-cell">Sent At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentLogs.map((log) => {
                        const logCfg = LOG_STATUS_CONFIG[log.status] || LOG_STATUS_CONFIG.pending;
                        return (
                          <tr key={log.id} className="border-b border-[#F9F9F9] last:border-0 hover:bg-[#F9F9F9]/60 transition-colors">
                            <td className="px-6 py-3">
                              <p className="text-xs font-medium text-[#2D2D2D]">{log.recipient_name || `#${log.recipient_id}`}</p>
                              {log.error_message && (
                                <p className="text-[10px] text-red-500 mt-0.5 truncate max-w-[180px]">{log.error_message}</p>
                              )}
                            </td>
                            <td className="px-6 py-3">
                              <span className="text-xs text-[#757575] capitalize">{log.recipient_type}</span>
                            </td>
                            <td className="px-6 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${logCfg.bg} ${logCfg.text}`}>
                                {log.status}
                              </span>
                            </td>
                            <td className="px-6 py-3 hidden md:table-cell">
                              <span className="text-[11px] text-[#757575]">
                                {log.sent_at
                                  ? new Date(log.sent_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
                                  : '—'
                                }
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Meta info ────────────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Timeline Card */}
            <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#F0F0F0] flex items-center gap-2.5">
                <Calendar size={15} style={{ color: 'var(--primary)' }} />
                <h2 className="text-sm font-bold text-[#2D2D2D]">Timeline</h2>
              </div>
              <div className="px-5 py-4 space-y-3">
                <TimelineItem
                  label="Created"
                  value={new Date(notif.created_at).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                    timeZone: 'Asia/Kolkata',
                  })}
                  icon={<FileText size={12} />}
                  color="#757575"
                />
                {notif.scheduled_at && (
                  <TimelineItem
                    label="Scheduled For"
                    value={new Date(notif.scheduled_at).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                      timeZone: 'Asia/Kolkata',
                    })}
                    icon={<Clock size={12} />}
                    color="#D9A05B"
                  />
                )}
                {notif.sent_at && (
                  <TimelineItem
                    label="Sent At"
                    value={new Date(notif.sent_at).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                      timeZone: 'Asia/Kolkata',
                    })}
                    icon={<Send size={12} />}
                    color="#2E7D32"
                  />
                )}
              </div>
            </div>

            {/* Audience Card */}
            <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#F0F0F0] flex items-center gap-2.5">
                <Filter size={15} style={{ color: 'var(--primary)' }} />
                <h2 className="text-sm font-bold text-[#2D2D2D]">Audience</h2>
              </div>
              <div className="px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#757575]">Type</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--light-purple)] text-xs font-medium rounded-full" style={{ color: 'var(--primary)' }}>
                    {AUDIENCE_LABELS[notif.audience_type] || notif.audience_type}
                  </span>
                </div>

                {notif.audience_type === 'partner_type' && !!notif.audience_filters.partner_status && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#757575]">Partner Status</span>
                    <span className="text-xs font-medium capitalize text-[#2D2D2D]">{String(notif.audience_filters.partner_status as string)}</span>
                  </div>
                )}

                {notif.audience_type === 'partner' && Array.isArray(notif.audience_filters.partner_ids) && notif.audience_filters.partner_ids.length > 0 && (
                  <div>
                    <span className="text-xs text-[#757575]">Partner IDs</span>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(notif.audience_filters.partner_ids as number[]).map((id) => (
                        <span key={id} className="px-2 py-0.5 bg-[var(--light-purple)] text-xs rounded-full" style={{ color: 'var(--primary)' }}>
                          #{id}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-[#F0F0F0]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#757575]">
                      {notif.status === 'sent' ? 'Actual Recipients' : 'Estimated Recipients'}
                    </span>
                    <span className="text-sm font-bold" style={{ color: 'var(--primary)' }}>
                      {notif.status === 'sent'
                        ? notif.actual_recipients.toLocaleString()
                        : `~${notif.estimated_recipients.toLocaleString()}`
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Meta Card */}
            <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#F0F0F0] flex items-center gap-2.5">
                <User size={15} style={{ color: 'var(--primary)' }} />
                <h2 className="text-sm font-bold text-[#2D2D2D]">Meta</h2>
              </div>
              <div className="px-5 py-4 space-y-2.5">
                <MetaRow label="Created By" value={notif.created_by_name || '—'} />
                <MetaRow label="Priority" value={<span className="capitalize">{notif.priority}</span>} />
                <MetaRow label="Channels" value={notif.channels.join(', ')} />
                <MetaRow label="Notification ID" value={<span className="font-mono text-[10px]">#{notif.id}</span>} />
              </div>
            </div>

            {/* Quick actions */}
            <div className="space-y-2">
              {canEdit && (
                <Link
                  href={`/admin/notifications/new?edit=${notif.id}`}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-[#E0E0E0] text-[#2D2D2D] hover:bg-[var(--light-purple)] transition-all"
                  style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
                >
                  <Pencil size={14} />
                  Edit Notification
                </Link>
              )}
              <Link
                href="/admin/notifications/new"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-[#E0E0E0] text-[#757575] hover:bg-[#F9F9F9] transition-all"
              >
                <Copy size={14} />
                Duplicate Notification
              </Link>
              <Link
                href="/admin/notifications"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-[#757575] hover:text-[#2D2D2D] transition-all"
              >
                <ArrowLeft size={14} />
                Back to Notifications
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[#bdbdbd] flex-shrink-0">{icon}</span>
      <span className="text-xs text-[#757575] w-24 flex-shrink-0">{label}</span>
      <span className="flex-1">{children}</span>
    </div>
  );
}

function TimelineItem({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-semibold text-[#757575] uppercase tracking-wider">{label}</p>
        <p className="text-xs text-[#2D2D2D] mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-[#757575]">{label}</span>
      <span className="text-xs text-[#2D2D2D] text-right">{value}</span>
    </div>
  );
}
