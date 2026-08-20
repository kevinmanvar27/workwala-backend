'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Bell, Send, Clock, FileText, Save,
  X, Users, Loader2, Eye, ChevronDown,
  AlertCircle, CheckCircle2, Image, Link2, Tag,
  Megaphone, UserCheck, Briefcase, Filter, Pencil,
} from 'lucide-react';
import PermissionGuard from '@/components/admin/PermissionGuard';
import { apiFetch } from '@/lib/apiFetch';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotifCategory { id: number; name: string; slug: string; color: string; }
interface ServiceCategory { id: number; name: string; slug: string; }
interface PartnerOption { id: number; name: string; phone: string; }
interface CustomerOption { id: number; name: string; phone: string; }
interface Role { id: number; name: string; slug: string; }

type AudienceType = 'all' | 'partner' | 'partner_type' | 'specific_user' | 'category' | 'role' | 'custom';
type Priority = 'low' | 'normal' | 'high';

interface FormState {
  title: string;
  body: string;
  category_id: string;
  image_url: string;
  action_url: string;
  audience_type: AudienceType;
  audience_filters: {
    partner_ids?: number[];
    partner_status?: string;
    user_ids?: number[];
    category_ids?: string[];
    role_ids?: number[];
    include_partners?: boolean;
    include_customers?: boolean;
  };
  priority: Priority;
  scheduled_at: string;
  notes: string;
  channels: string[];
}

// Returns current time + 1 minute in datetime-local format (YYYY-MM-DDTHH:mm) in IST
const getNow = () => {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  return new Date(Date.now() + 60000 + IST_OFFSET_MS).toISOString().slice(0, 16);
};

const EMPTY_FORM: FormState = {
  title: '', body: '', category_id: '', image_url: '', action_url: '',
  audience_type: 'all', audience_filters: {},
  priority: 'normal', scheduled_at: getNow(), notes: '', channels: ['push'],
};

const AUDIENCE_OPTIONS: { value: AudienceType; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'all',           label: 'All Users',     icon: <Users size={15} />,     desc: 'Send to all partners and customers' },
  { value: 'partner',       label: 'Partners',       icon: <Briefcase size={15} />, desc: 'Send to all or specific partners' },
  { value: 'partner_type',  label: 'Partner Type',   icon: <UserCheck size={15} />, desc: 'Send to partners by approval status' },
  { value: 'specific_user', label: 'Specific Users', icon: <Users size={15} />,     desc: 'Send to specific customers by ID' },
  { value: 'category',      label: 'By Category',    icon: <Tag size={15} />,       desc: 'Send to partners in specific service categories' },
  { value: 'role',          label: 'By Role',        icon: <Filter size={15} />,    desc: 'Send to admin users by role' },
  { value: 'custom',        label: 'Custom',         icon: <Filter size={15} />,    desc: 'Combine partners and customers with filters' },
];

const PARTNER_STATUSES = ['pending', 'approved', 'rejected', 'suspended', 'inactive', 'banned'];

// ─── Confirmation Modal ───────────────────────────────────────────────────────

interface ConfirmModalProps {
  form: FormState;
  notifCategories: NotifCategory[];
  estimatedCount: number;
  action: 'send' | 'schedule';
  isEdit: boolean;
  onConfirm: () => void;
  onClose: () => void;
  saving: boolean;
}

function ConfirmModal({ form, notifCategories, estimatedCount, action, isEdit, onConfirm, onClose, saving }: ConfirmModalProps) {
  const cat = notifCategories.find((c) => String(c.id) === form.category_id);
  const audienceLabel = AUDIENCE_OPTIONS.find((a) => a.value === form.audience_type)?.label || form.audience_type;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0E0E0]">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: action === 'send' ? '#F0FAF4' : '#FFF8EA' }}
            >
              {action === 'send'
                ? <Send size={16} className="text-[#2E7D32]" />
                : <Clock size={16} className="text-amber-600" />
              }
            </div>
            <h2 className="text-base font-bold text-[#2D2D2D]">
              {isEdit
                ? action === 'send' ? 'Confirm Update & Send' : 'Confirm Update & Schedule'
                : action === 'send' ? 'Confirm Send Now' : 'Confirm Schedule'
              }
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#757575] hover:bg-[#F9F9F9] rounded-lg transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Notification preview */}
          <div className="p-4 bg-[#F9F9F9] rounded-xl border border-[#E0E0E0]">
            <div className="flex items-start gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: cat?.color ? `${cat.color}20` : 'var(--light-purple)' }}
              >
                <Bell size={14} style={{ color: cat?.color || 'var(--primary)' }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#2D2D2D] leading-snug">{form.title}</p>
                <p className="text-xs text-[#757575] mt-1 leading-relaxed">{form.body}</p>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2.5">
            <DetailRow label="Category" value={cat?.name || '—'} />
            <DetailRow label="Audience" value={audienceLabel} />
            <DetailRow
              label="Est. Recipients"
              value={<span className="font-bold" style={{ color: 'var(--primary)' }}>~{estimatedCount.toLocaleString()}</span>}
            />
            <DetailRow label="Priority" value={<span className="capitalize">{form.priority}</span>} />
            {action === 'schedule' && form.scheduled_at && (
              <DetailRow
                label="Scheduled For"
                value={
                  <span className="text-amber-600 font-medium">
                    {new Date(form.scheduled_at).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                      timeZone: 'Asia/Kolkata',
                    })}
                  </span>
                }
              />
            )}
            <DetailRow label="Channels" value={form.channels.join(', ')} />
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              {action === 'send'
                ? 'This will immediately send the notification to all targeted recipients. This action cannot be undone.'
                : 'This will schedule the notification for the selected date and time. You can cancel it before it sends.'
              }
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2.5 border border-[#E0E0E0] rounded-xl text-sm font-semibold text-[#757575] hover:bg-[#F9F9F9] transition-all disabled:opacity-60"
          >
            Go Back
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: action === 'send' ? '#2E7D32' : 'var(--primary)' }}
          >
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> {action === 'send' ? 'Sending…' : 'Scheduling…'}</>
              : action === 'send'
                ? <><Send size={14} /> Send Now</>
                : <><Clock size={14} /> Confirm Schedule</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-[#757575] flex-shrink-0">{label}</span>
      <span className="text-xs text-[#2D2D2D] text-right">{value}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NewNotificationPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" /></div>}>
      <NewNotificationPageInner />
    </Suspense>
  );
}

function NewNotificationPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // edit mode: /admin/notifications/new?edit=<id>
  const editId = searchParams.get('edit');
  const isEdit = !!editId;

  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [loadingEdit, setLoadingEdit] = useState(isEdit);
  const [originalStatus, setOriginalStatus] = useState<string>('draft');

  const [notifCategories, setNotifCategories] = useState<NotifCategory[]>([]);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [partnerSearch, setPartnerSearch] = useState('');
  const [partnerOptions, setPartnerOptions] = useState<PartnerOption[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);

  const [estimatedCount, setEstimatedCount] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'send' | 'schedule' | null>(null);

  // Derived: true only when the selected datetime is strictly in the future
  const isFuture = form.scheduled_at
    ? new Date(form.scheduled_at) > new Date()
    : false;

  // ── Load reference data ──────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/notification-categories?active=1').then((r) => r.json()),
      fetch('/api/admin/categories').then((r) => r.json()),
      fetch('/api/admin/roles').then((r) => r.json()),
    ]).then(([cats, serviceCats, rolesData]) => {
      setNotifCategories(cats.categories || []);
      setServiceCategories(serviceCats.categories || []);
      setRoles(rolesData.roles || []);
    }).catch(() => {});
  }, []);

  // ── Load existing notification when editing ──────────────────────────────

  useEffect(() => {
    if (!editId) return;
    setLoadingEdit(true);
    fetch(`/api/admin/push-notifications/${editId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.notification) { toast.error('Notification not found'); router.push('/admin/notifications'); return; }
        const n = data.notification;

        // Only draft/scheduled can be edited
        if (!['draft', 'scheduled'].includes(n.status)) {
          toast.error('Only draft or scheduled notifications can be edited');
          router.push(`/admin/notifications/${editId}`);
          return;
        }

        setOriginalStatus(n.status);

        // Pre-fill form from existing notification
        setForm({
          title:            n.title || '',
          body:             n.body || '',
          category_id:      n.category_id ? String(n.category_id) : '',
          image_url:        n.image_url || '',
          action_url:       n.action_url || '',
          audience_type:    (n.audience_type as AudienceType) || 'all',
          audience_filters: (n.audience_filters as FormState['audience_filters']) || {},
          priority:         (n.priority as Priority) || 'normal',
          // Convert stored UTC datetime to local datetime-local string
          scheduled_at:     n.scheduled_at
            ? new Date(n.scheduled_at).toISOString().slice(0, 16)
            : getNow(),
          notes:    n.notes || '',
          channels: Array.isArray(n.channels) ? n.channels : ['push'],
        });
        setEstimatedCount(n.estimated_recipients || 0);
      })
      .catch(() => { toast.error('Failed to load notification'); router.push('/admin/notifications'); })
      .finally(() => setLoadingEdit(false));
  }, [editId, router]);

  // ── Partner search ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!partnerSearch.trim()) { setPartnerOptions([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/partners?search=${encodeURIComponent(partnerSearch)}&limit=10`);
        const data = await res.json();
        setPartnerOptions((data.partners || []).map((p: { id: number; name: string; phone: string }) => ({
          id: p.id, name: p.name || p.phone, phone: p.phone,
        })));
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(t);
  }, [partnerSearch]);

  // ── Customer search ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!customerSearch.trim()) { setCustomerOptions([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/users?search=${encodeURIComponent(customerSearch)}&limit=10`);
        const data = await res.json();
        setCustomerOptions((data.users || []).map((u: { id: number; name: string; email: string }) => ({
          id: u.id, name: u.name, phone: u.email,
        })));
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(t);
  }, [customerSearch]);

  // ── Audience preview ─────────────────────────────────────────────────────

  const fetchAudiencePreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const res = await apiFetch('/api/admin/push-notifications/audience-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audience_type: form.audience_type, audience_filters: form.audience_filters }),
      });
      const data = await res.json();
      if (res.ok) setEstimatedCount(data.estimated_count ?? 0);
    } catch { /* ignore */ }
    finally { setPreviewLoading(false); }
  }, [form.audience_type, form.audience_filters]);

  useEffect(() => {
    if (!loadingEdit) fetchAudiencePreview();
  }, [fetchAudiencePreview, loadingEdit]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setFilter = (key: string, value: unknown) =>
    setForm((f) => ({ ...f, audience_filters: { ...f.audience_filters, [key]: value } }));

  const togglePartner = (id: number) => {
    const cur = form.audience_filters.partner_ids || [];
    setFilter('partner_ids', cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };
  const toggleCustomer = (id: number) => {
    const cur = form.audience_filters.user_ids || [];
    setFilter('user_ids', cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };
  const toggleCategory = (slug: string) => {
    const cur = form.audience_filters.category_ids || [];
    setFilter('category_ids', cur.includes(slug) ? cur.filter((x) => x !== slug) : [...cur, slug]);
  };
  const toggleRole = (id: number) => {
    const cur = form.audience_filters.role_ids || [];
    setFilter('role_ids', cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };

  // ── Validation ───────────────────────────────────────────────────────────

  const validate = (action: 'draft' | 'send' | 'schedule'): boolean => {
    if (!form.title.trim()) { toast.error('Title is required'); return false; }
    if (!form.body.trim())  { toast.error('Message body is required'); return false; }
    if (action === 'schedule') {
      if (!form.scheduled_at) { toast.error('Please select a scheduled date and time'); return false; }
      if (new Date(form.scheduled_at) <= new Date()) { toast.error('Scheduled time must be in the future'); return false; }
    }
    return true;
  };

  // ── Save / Update ─────────────────────────────────────────────────────────

  const handleSave = async (action: 'draft' | 'send' | 'schedule') => {
    if (!validate(action)) return;
    if (action === 'send' || action === 'schedule') {
      setConfirmAction(action);
      return;
    }
    await doSave('draft');
  };

  const doSave = async (finalStatus: string) => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        category_id:          form.category_id ? parseInt(form.category_id) : null,
        status:               finalStatus,
        estimated_recipients: estimatedCount,
        scheduled_at:         form.scheduled_at || null,
      };

      let res: Response;

      if (isEdit && editId) {
        // ── PATCH: update existing notification ──────────────────────────────
        res = await apiFetch('/api/admin/push-notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: parseInt(editId), ...payload }),
        });
      } else {
        // ── POST: create new notification ────────────────────────────────────
        res = await apiFetch('/api/admin/push-notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();

      if (res.ok) {
        toast.success(
          finalStatus === 'draft'     ? (isEdit ? 'Draft updated' : 'Saved as draft') :
          finalStatus === 'scheduled' ? (isEdit ? 'Notification rescheduled!' : 'Notification scheduled!') :
          'Notification is being sent!'
        );
        // After edit+send, go to detail; otherwise go to list
        if (isEdit && editId && finalStatus === 'sending') {
          router.push(`/admin/notifications/${editId}`);
        } else {
          router.push('/admin/notifications');
        }
      } else {
        toast.error(data.error || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
      setConfirmAction(null);
    }
  };

  const handleConfirm = () => {
    if (confirmAction === 'send')     doSave('sending');
    else if (confirmAction === 'schedule') doSave('scheduled');
  };

  // ─── Loading skeleton (edit mode only) ───────────────────────────────────

  if (loadingEdit) {
    return (
      <PermissionGuard permission="notifications.create">
        <div className="p-6 lg:p-8 w-full space-y-5 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-[var(--light-purple)] rounded-xl" />
            <div className="space-y-2">
              <div className="h-6 bg-[var(--light-purple)] rounded-lg w-56" />
              <div className="h-3 bg-[var(--light-purple)] rounded w-40" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              <div className="h-64 bg-[var(--light-purple)] rounded-2xl" />
              <div className="h-48 bg-[var(--light-purple)] rounded-2xl" />
            </div>
            <div className="space-y-5">
              <div className="h-32 bg-[var(--light-purple)] rounded-2xl" />
              <div className="h-48 bg-[var(--light-purple)] rounded-2xl" />
            </div>
          </div>
        </div>
      </PermissionGuard>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <PermissionGuard permission="notifications.create">
      <div className="p-6 lg:p-8 w-full">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => isEdit ? router.push(`/admin/notifications/${editId}`) : router.back()}
            className="p-2 text-[#757575] hover:bg-[var(--light-purple)] rounded-xl transition-all border border-[#E0E0E0]"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-[#2D2D2D] tracking-tight">
                {isEdit ? 'Edit Notification' : 'New Notification'}
              </h1>
              {isEdit && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--light-purple)]" style={{ color: 'var(--primary)' }}>
                  <Pencil size={10} />
                  Editing #{editId}
                </span>
              )}
            </div>
            <p className="text-[#757575] text-sm mt-0.5">
              {isEdit
                ? `Editing a ${originalStatus} notification — changes save immediately`
                : 'Create a push notification campaign'
              }
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left: Main form ─────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Notification Content Card */}
            <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-[#F0F0F0] flex items-center gap-2.5">
                <Megaphone size={16} style={{ color: 'var(--primary)' }} />
                <h2 className="text-sm font-bold text-[#2D2D2D]">Notification Content</h2>
              </div>
              <div className="px-6 py-5 space-y-4">

                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold text-[#757575] uppercase tracking-wider mb-1.5">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setField('title', e.target.value)}
                    placeholder="e.g. New offer available for you!"
                    maxLength={100}
                    className="w-full px-4 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#bdbdbd] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                  />
                  <p className="text-[10px] text-[#bdbdbd] mt-1 text-right">{form.title.length}/100</p>
                </div>

                {/* Body */}
                <div>
                  <label className="block text-xs font-semibold text-[#757575] uppercase tracking-wider mb-1.5">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={form.body}
                    onChange={(e) => setField('body', e.target.value)}
                    placeholder="Write your notification message here…"
                    rows={3}
                    maxLength={500}
                    className="w-full px-4 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#bdbdbd] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all resize-none"
                  />
                  <p className="text-[10px] text-[#bdbdbd] mt-1 text-right">{form.body.length}/500</p>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-semibold text-[#757575] uppercase tracking-wider mb-1.5">Category</label>
                  <div className="relative">
                    <select
                      value={form.category_id}
                      onChange={(e) => setField('category_id', e.target.value)}
                      className="w-full px-4 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all appearance-none bg-white"
                    >
                      <option value="">Select a category…</option>
                      {notifCategories.map((c) => (
                        <option key={c.id} value={String(c.id)}>{c.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#757575] pointer-events-none" />
                  </div>
                </div>

                {/* Image URL */}
                <div>
                  <label className="block text-xs font-semibold text-[#757575] uppercase tracking-wider mb-1.5">
                    <span className="flex items-center gap-1.5"><Image size={11} /> Image URL (optional)</span>
                  </label>
                  <input
                    type="url"
                    value={form.image_url}
                    onChange={(e) => setField('image_url', e.target.value)}
                    placeholder="https://example.com/image.png"
                    className="w-full px-4 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#bdbdbd] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                  />
                </div>

                {/* Action URL */}
                <div>
                  <label className="block text-xs font-semibold text-[#757575] uppercase tracking-wider mb-1.5">
                    <span className="flex items-center gap-1.5"><Link2 size={11} /> Action / Deep Link (optional)</span>
                  </label>
                  <input
                    type="text"
                    value={form.action_url}
                    onChange={(e) => setField('action_url', e.target.value)}
                    placeholder="e.g. app://offers or https://…"
                    className="w-full px-4 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#bdbdbd] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-[#757575] uppercase tracking-wider mb-1.5">
                    Internal Notes (optional)
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setField('notes', e.target.value)}
                    placeholder="Notes visible only to admins…"
                    rows={2}
                    className="w-full px-4 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#bdbdbd] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all resize-none"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* ── Right: Settings + Actions ────────────────────────────────── */}
          <div className="space-y-5">

            {/* Target Audience */}
            <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#F0F0F0] flex items-center gap-2.5">
                <Users size={15} style={{ color: 'var(--primary)' }} />
                <h2 className="text-sm font-bold text-[#2D2D2D]">Target Audience</h2>
              </div>
              <div className="px-5 py-4 space-y-4">

                {/* Audience type selector */}
                <div className="grid grid-cols-2 gap-2">
                  {AUDIENCE_OPTIONS.map((opt) => {
                    const isSelected = form.audience_type === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { setField('audience_type', opt.value); setField('audience_filters', {}); }}
                        className="flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition-all"
                        style={{
                          borderColor:     isSelected ? 'var(--primary)' : '#E0E0E0',
                          backgroundColor: isSelected ? 'var(--light-purple)' : 'white',
                        }}
                      >
                        <span style={{ color: isSelected ? 'var(--primary)' : '#757575' }}>{opt.icon}</span>
                        <span className="text-xs font-semibold leading-tight" style={{ color: isSelected ? 'var(--primary)' : '#2D2D2D' }}>
                          {opt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Sub-filters */}
                {form.audience_type === 'partner' && (
                  <div className="space-y-3">
                    <p className="text-xs text-[#757575]">Leave empty to target all partners, or search and select specific ones.</p>
                    <input
                      type="text"
                      value={partnerSearch}
                      onChange={(e) => setPartnerSearch(e.target.value)}
                      placeholder="Search partners by name or phone…"
                      className="w-full px-4 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#bdbdbd] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                    />
                    {partnerOptions.length > 0 && (
                      <div className="border border-[#E0E0E0] rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                        {partnerOptions.map((p) => {
                          const selected = (form.audience_filters.partner_ids || []).includes(p.id);
                          return (
                            <button key={p.id} type="button" onClick={() => togglePartner(p.id)}
                              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#F9F9F9] transition-colors text-left border-b border-[#F0F0F0] last:border-0">
                              <span className="text-sm text-[#2D2D2D]">{p.name} <span className="text-[#757575] text-xs">({p.phone})</span></span>
                              {selected && <CheckCircle2 size={14} style={{ color: 'var(--primary)' }} />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {(form.audience_filters.partner_ids || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {(form.audience_filters.partner_ids || []).map((id) => (
                          <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--light-purple)] text-xs font-medium rounded-full" style={{ color: 'var(--primary)' }}>
                            Partner #{id}
                            <button onClick={() => togglePartner(id)} className="hover:opacity-70"><X size={10} /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {form.audience_type === 'partner_type' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#757575] uppercase tracking-wider mb-1.5">Partner Status</label>
                    <div className="relative">
                      <select
                        value={form.audience_filters.partner_status || 'approved'}
                        onChange={(e) => setFilter('partner_status', e.target.value)}
                        className="w-full px-4 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all appearance-none bg-white"
                      >
                        {PARTNER_STATUSES.map((s) => (
                          <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#757575] pointer-events-none" />
                    </div>
                  </div>
                )}

                {form.audience_type === 'specific_user' && (
                  <div className="space-y-3">
                    <p className="text-xs text-[#757575]">Search and select specific customers.</p>
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Search customers by name or email…"
                      className="w-full px-4 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#bdbdbd] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                    />
                    {customerOptions.length > 0 && (
                      <div className="border border-[#E0E0E0] rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                        {customerOptions.map((c) => {
                          const selected = (form.audience_filters.user_ids || []).includes(c.id);
                          return (
                            <button key={c.id} type="button" onClick={() => toggleCustomer(c.id)}
                              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#F9F9F9] transition-colors text-left border-b border-[#F0F0F0] last:border-0">
                              <span className="text-sm text-[#2D2D2D]">{c.name} <span className="text-[#757575] text-xs">({c.phone})</span></span>
                              {selected && <CheckCircle2 size={14} style={{ color: 'var(--primary)' }} />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {(form.audience_filters.user_ids || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {(form.audience_filters.user_ids || []).map((id) => (
                          <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--light-purple)] text-xs font-medium rounded-full" style={{ color: 'var(--primary)' }}>
                            User #{id}
                            <button onClick={() => toggleCustomer(id)} className="hover:opacity-70"><X size={10} /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {form.audience_type === 'category' && (
                  <div className="space-y-2">
                    <p className="text-xs text-[#757575]">Select service categories — partners in these categories will be targeted.</p>
                    <div className="flex flex-wrap gap-2">
                      {serviceCategories.map((cat) => {
                        const selected = (form.audience_filters.category_ids || []).includes(cat.slug);
                        return (
                          <button key={cat.id} type="button" onClick={() => toggleCategory(cat.slug)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-xs font-medium transition-all"
                            style={{
                              borderColor:     selected ? 'var(--primary)' : '#E0E0E0',
                              backgroundColor: selected ? 'var(--light-purple)' : 'white',
                              color:           selected ? 'var(--primary)' : '#757575',
                            }}>
                            {selected && <CheckCircle2 size={11} />}
                            {cat.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {form.audience_type === 'role' && (
                  <div className="space-y-2">
                    <p className="text-xs text-[#757575]">Select admin roles to target.</p>
                    <div className="flex flex-wrap gap-2">
                      {roles.map((role) => {
                        const selected = (form.audience_filters.role_ids || []).includes(role.id);
                        return (
                          <button key={role.id} type="button" onClick={() => toggleRole(role.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-xs font-medium transition-all"
                            style={{
                              borderColor:     selected ? 'var(--primary)' : '#E0E0E0',
                              backgroundColor: selected ? 'var(--light-purple)' : 'white',
                              color:           selected ? 'var(--primary)' : '#757575',
                            }}>
                            {selected && <CheckCircle2 size={11} />}
                            {role.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {form.audience_type === 'custom' && (
                  <div className="space-y-3">
                    <p className="text-xs text-[#757575]">Combine audience segments with optional filters.</p>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 p-3 border border-[#E0E0E0] rounded-xl cursor-pointer hover:bg-[#F9F9F9] transition-colors">
                        <input type="checkbox" checked={form.audience_filters.include_partners !== false}
                          onChange={(e) => setFilter('include_partners', e.target.checked)}
                          className="w-4 h-4 rounded" style={{ accentColor: 'var(--primary)' }} />
                        <div>
                          <p className="text-sm font-medium text-[#2D2D2D]">Include Partners</p>
                          <p className="text-xs text-[#757575]">All partners with FCM tokens</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 p-3 border border-[#E0E0E0] rounded-xl cursor-pointer hover:bg-[#F9F9F9] transition-colors">
                        <input type="checkbox" checked={form.audience_filters.include_customers !== false}
                          onChange={(e) => setFilter('include_customers', e.target.checked)}
                          className="w-4 h-4 rounded" style={{ accentColor: 'var(--primary)' }} />
                        <div>
                          <p className="text-sm font-medium text-[#2D2D2D]">Include Customers</p>
                          <p className="text-xs text-[#757575]">All customers with FCM tokens</p>
                        </div>
                      </label>
                    </div>
                    {form.audience_filters.include_partners !== false && (
                      <div>
                        <label className="block text-xs font-semibold text-[#757575] uppercase tracking-wider mb-1.5">
                          Partner Status Filter (optional)
                        </label>
                        <div className="relative">
                          <select
                            value={form.audience_filters.partner_status || ''}
                            onChange={(e) => setFilter('partner_status', e.target.value || undefined)}
                            className="w-full px-4 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all appearance-none bg-white"
                          >
                            <option value="">All statuses</option>
                            {PARTNER_STATUSES.map((s) => (
                              <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                            ))}
                          </select>
                          <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#757575] pointer-events-none" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Settings */}
            <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#F0F0F0] flex items-center gap-2.5">
                <Bell size={15} style={{ color: 'var(--primary)' }} />
                <h2 className="text-sm font-bold text-[#2D2D2D]">Settings</h2>
              </div>
              <div className="px-5 py-4 space-y-4">

                {/* Priority */}
                <div>
                  <label className="block text-xs font-semibold text-[#757575] uppercase tracking-wider mb-1.5">Priority</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['low', 'normal', 'high'] as Priority[]).map((p) => (
                      <button key={p} type="button" onClick={() => setField('priority', p)}
                        className="py-2 rounded-lg border-2 text-xs font-semibold capitalize transition-all"
                        style={{
                          borderColor:     form.priority === p ? 'var(--primary)' : '#E0E0E0',
                          backgroundColor: form.priority === p ? 'var(--light-purple)' : 'white',
                          color:           form.priority === p ? 'var(--primary)' : '#757575',
                        }}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Schedule */}
                <div>
                  <label className="block text-xs font-semibold text-[#757575] uppercase tracking-wider mb-1.5">
                    Schedule Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={form.scheduled_at}
                    min={(() => { const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 16); })()}
                    onChange={(e) => setField('scheduled_at', e.target.value)}
                    className="w-full px-4 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                  />
                  <p className="text-[10px] text-[#bdbdbd] mt-1">
                    {isFuture ? 'Notification will be scheduled for this time.' : 'Set a future time to schedule, or send now.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5">
              {/* Send Now — only when selected time is NOT in the future */}
              {!isFuture && (
                <button
                  onClick={() => handleSave('send')}
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: '#2E7D32' }}
                >
                  <Send size={15} />
                  {isEdit ? 'Update & Send Now' : 'Send Now'}
                </button>
              )}

              {/* Schedule — only when selected time IS in the future */}
              {isFuture && (
                <button
                  onClick={() => handleSave('schedule')}
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  <Clock size={15} />
                  {isEdit ? 'Update & Schedule' : 'Schedule'}
                </button>
              )}

              {/* Save Draft — always visible */}
              <button
                onClick={() => handleSave('draft')}
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-[#757575] border border-[#E0E0E0] hover:bg-[#F9F9F9] transition-all disabled:opacity-60"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {isEdit ? 'Save Changes' : 'Save as Draft'}
              </button>

              {/* Cancel */}
              <button
                onClick={() => isEdit ? router.push(`/admin/notifications/${editId}`) : router.back()}
                className="w-full text-xs text-[#757575] hover:text-[#2D2D2D] py-2 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <ConfirmModal
          form={form}
          notifCategories={notifCategories}
          estimatedCount={estimatedCount}
          action={confirmAction}
          isEdit={isEdit}
          onConfirm={handleConfirm}
          onClose={() => setConfirmAction(null)}
          saving={saving}
        />
      )}
    </PermissionGuard>
  );
}
