'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Ticket, Wand2, Check, Loader2,
  Percent, DollarSign, Users, Calendar, Shield, Tag,
  Info, ChevronDown, ChevronUp, AlertTriangle,
  Clock, Eye, EyeOff, Sparkles, RefreshCw,
  MapPin, Handshake, UserCheck, UserPlus, Repeat2, Star, User,
  LayoutGrid, Zap,
} from 'lucide-react';
import PermissionGuard from '@/components/admin/PermissionGuard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category { id: number; name: string; }
interface Partner  { id: number; name: string; phone: string; }

type DiscountType  = 'percentage' | 'fixed';
type AudienceType  = 'all' | 'specific_users' | 'city' | 'partner' | 'user_type' | 'new_users' | 'existing_users' | 'first_time';
type CouponStatus  = 'draft' | 'scheduled' | 'active';

interface CouponForm {
  code: string;
  auto_generate: boolean;
  code_length: string;
  code_prefix: string;
  name: string;
  description: string;
  terms_conditions: string;
  discount_type: DiscountType;
  discount_value: string;
  min_order_value: string;
  max_discount_amount: string;
  max_total_usage: string;
  max_usage_per_user: string;
  once_per_order: boolean;
  combinable: boolean;
  starts_at: string;
  expires_at: string;
  status: CouponStatus;
  audience_type: AudienceType;
  audience_cities: string;
  applicable_categories: number[];
  applicable_partners: number[];
  applicable_cities: string[];
  applicable_services: number[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns current datetime string in `datetime-local` format (YYYY-MM-DDTHH:mm),
 *  rounded down to the current minute — expressed in IST (Asia/Kolkata, UTC+5:30). */
function nowLocal(): string {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 16);
}

function nowPlusDays(days: number) {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000 + IST_OFFSET_MS).toISOString().slice(0, 16);
}

/** Parse a datetime-local string (YYYY-MM-DDTHH:mm) as local time — NOT UTC.
 *  `new Date("2026-08-15T15:30")` is ambiguous across engines; this is explicit. */
function parseLocalDT(s: string): number {
  if (!s) return 0;
  const [datePart, timePart] = s.split('T');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [h, mi]    = (timePart || '00:00').split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi).getTime();
}

/** True when the given datetime-local string is strictly in the future (> 1 min from now). */
function isFuture(datetimeLocal: string): boolean {
  if (!datetimeLocal) return false;
  // 1-minute buffer so "right now" doesn't flicker
  return parseLocalDT(datetimeLocal) - Date.now() > 60 * 1000;
}

const EMPTY_FORM: CouponForm = {
  code: '', auto_generate: false, code_length: '8', code_prefix: '',
  name: '', description: '', terms_conditions: '',
  discount_type: 'percentage', discount_value: '',
  min_order_value: '0', max_discount_amount: '',
  max_total_usage: '', max_usage_per_user: '1',
  once_per_order: true, combinable: false,
  starts_at: '',   // filled at mount — see useState initializer below
  expires_at: '',  // filled at mount
  status: 'draft',
  audience_type: 'all',
  audience_cities: '',
  applicable_categories: [],
  applicable_partners: [],
  applicable_cities: [],
  applicable_services: [],
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, icon, children, defaultOpen = true, badge }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#FAFAFA] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--light-purple)' }}>
            <span style={{ color: 'var(--primary)' }}>{icon}</span>
          </div>
          <span className="text-sm font-bold text-[#1A1A1A]">{title}</span>
          {badge && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--light-purple)', color: 'var(--primary)' }}>
              {badge}
            </span>
          )}
        </div>
        {open
          ? <ChevronUp size={15} className="text-[#BDBDBD] flex-shrink-0" />
          : <ChevronDown size={15} className="text-[#BDBDBD] flex-shrink-0" />
        }
      </button>
      {open && (
        <div className="px-6 pb-6 pt-1 space-y-5 border-t border-[#F0F0F0]">
          {children}
        </div>
      )}
    </div>
  );
}

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#757575] uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-[#BDBDBD] mt-1.5 leading-relaxed">{hint}</p>}
    </div>
  );
}

// Toggle switch
function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: () => void; label: string; desc?: string }) {
  return (
    <div
      className="flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all select-none"
      style={checked ? { borderColor: 'var(--primary)', backgroundColor: 'var(--light-purple)' } : { borderColor: '#E8E8E8', backgroundColor: 'white' }}
      onClick={onChange}
    >
      <div>
        <p className="text-sm font-semibold text-[#1A1A1A]">{label}</p>
        {desc && <p className="text-[11px] text-[#757575] mt-0.5">{desc}</p>}
      </div>
      <div
        className="relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ml-4"
        style={{ backgroundColor: checked ? 'var(--primary)' : '#E0E0E0' }}
      >
        <span
          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform"
          style={{ transform: checked ? 'translateX(18px)' : 'translateX(4px)' }}
        />
      </div>
    </div>
  );
}

const inputCls = 'w-full px-4 py-2.5 border border-[#E8E8E8] rounded-xl text-sm text-[#1A1A1A] placeholder-[#C0C0C0] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all bg-white';

// ─── Audience options with Lucide icons ───────────────────────────────────────

const AUDIENCE_OPTIONS: { value: AudienceType; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'all',            label: 'All Users',      icon: <Users size={15} />,      desc: 'Every registered user' },
  { value: 'new_users',      label: 'New Users',      icon: <UserPlus size={15} />,   desc: 'Registered in last 30 days' },
  { value: 'existing_users', label: 'Existing Users', icon: <Repeat2 size={15} />,    desc: 'Users with prior orders' },
  { value: 'first_time',     label: 'First-Time',     icon: <Star size={15} />,       desc: 'No previous orders' },
  { value: 'specific_users', label: 'Specific Users', icon: <User size={15} />,       desc: 'Manually selected users' },
  { value: 'city',           label: 'By City',        icon: <MapPin size={15} />,     desc: 'Filter by city' },
  { value: 'partner',        label: 'By Partner',     icon: <Handshake size={15} />,  desc: 'Specific partners only' },
  { value: 'user_type',      label: 'By User Type',   icon: <UserCheck size={15} />,  desc: 'Filter by account type' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CouponFormPage({
  couponId, initialData,
}: {
  couponId?: number;
  initialData?: Partial<CouponForm> & { id?: number };
}) {
  const router  = useRouter();
  const isEdit  = !!couponId;

  const [form, setForm] = useState<CouponForm>(() => ({
    ...EMPTY_FORM,
    // Set fresh timestamps at mount so they always reflect actual current time
    starts_at:  nowLocal(),
    expires_at: nowPlusDays(30),
    // initialData (edit mode) overrides everything including dates
    ...(initialData || {}),
  }));
  const [saving, setSaving]                 = useState(false);
  const [savingAs, setSavingAs]             = useState<CouponStatus | null>(null);
  const [generating, setGenerating]         = useState(false);
  const [codeAvailable, setCodeAvailable]   = useState<boolean | null>(null);
  const [checkingCode, setCheckingCode]     = useState(false);
  const [categories, setCategories]         = useState<Category[]>([]);
  const [partners, setPartners]             = useState<Partner[]>([]);
  const [showConfirm, setShowConfirm]       = useState(false);
  const [pendingStatus, setPendingStatus]   = useState<CouponStatus | null>(null);

  const set = <K extends keyof CouponForm>(key: K, val: CouponForm[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  // True when the selected start time is meaningfully in the future → Schedule mode
  const isScheduleMode = isFuture(form.starts_at);

  // ── Load categories + partners ─────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/categories').then((r) => r.json()).catch(() => ({ categories: [] })),
      fetch('/api/admin/partners?limit=200').then((r) => r.json()).catch(() => ({ partners: [] })),
    ]).then(([catData, partData]) => {
      setCategories(catData.categories || []);
      setPartners(partData.partners || []);
    });
  }, []);

  // ── Code availability check ────────────────────────────────────────────────

  const checkCode = useCallback(async (code: string) => {
    if (!code || code.length < 3) { setCodeAvailable(null); return; }
    setCheckingCode(true);
    try {
      const res = await fetch(`/api/admin/coupons/generate-code?code=${encodeURIComponent(code)}${isEdit ? `&exclude_id=${couponId}` : ''}`);
      const data = await res.json();
      setCodeAvailable(data.available);
    } catch {
      setCodeAvailable(null);
    } finally {
      setCheckingCode(false);
    }
  }, [isEdit, couponId]);

  useEffect(() => {
    if (form.auto_generate) return;
    const timer = setTimeout(() => checkCode(form.code), 500);
    return () => clearTimeout(timer);
  }, [form.code, form.auto_generate, checkCode]);

  // ── Auto-generate code ─────────────────────────────────────────────────────

  const generateCode = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/admin/coupons/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ length: parseInt(form.code_length) || 8, prefix: form.code_prefix }),
      });
      const data = await res.json();
      if (data.code) { set('code', data.code); setCodeAvailable(true); }
    } catch {
      toast.error('Failed to generate code');
    } finally {
      setGenerating(false);
    }
  };

  // ── Toggle multi-select ────────────────────────────────────────────────────

  const toggleId = (key: 'applicable_categories' | 'applicable_partners' | 'applicable_services', id: number) => {
    setForm((f) => {
      const arr = f[key] as number[];
      return { ...f, [key]: arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id] };
    });
  };

  // ── Validate ───────────────────────────────────────────────────────────────

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Coupon name is required';
    if (!form.auto_generate && !form.code.trim()) return 'Coupon code is required';
    if (!form.auto_generate && form.code.length < 3) return 'Code must be at least 3 characters';
    if (!form.discount_value || isNaN(Number(form.discount_value))) return 'Discount value is required';
    if (form.discount_type === 'percentage' && (Number(form.discount_value) <= 0 || Number(form.discount_value) > 100))
      return 'Percentage must be between 1 and 100';
    if (Number(form.discount_value) <= 0) return 'Discount value must be greater than 0';
    if (!form.starts_at) return 'Start date is required';
    if (!form.expires_at) return 'Expiry date is required';
    if (new Date(form.expires_at) <= new Date(form.starts_at)) return 'Expiry must be after start date';
    return null;
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async (statusOverride?: CouponStatus) => {
    const err = validate();
    if (err) { toast.error(err); return; }

    const finalStatus = statusOverride || form.status;

    if ((finalStatus === 'active' || finalStatus === 'scheduled') && !showConfirm) {
      setPendingStatus(finalStatus);
      setShowConfirm(true);
      return;
    }

    setSaving(true);
    setSavingAs(finalStatus);
    setShowConfirm(false);
    try {
      const payload: Record<string, unknown> = {
        ...(isEdit ? { id: couponId } : {}),
        code: form.auto_generate ? undefined : form.code.toUpperCase().trim(),
        auto_generate: form.auto_generate,
        code_length: parseInt(form.code_length) || 8,
        name: form.name.trim(),
        description: form.description.trim() || null,
        terms_conditions: form.terms_conditions.trim() || null,
        discount_type: form.discount_type,
        discount_value: parseFloat(form.discount_value),
        min_order_value: parseFloat(form.min_order_value) || 0,
        max_discount_amount: form.max_discount_amount ? parseFloat(form.max_discount_amount) : null,
        max_total_usage: form.max_total_usage ? parseInt(form.max_total_usage) : null,
        max_usage_per_user: parseInt(form.max_usage_per_user) || 1,
        once_per_order: form.once_per_order,
        combinable: form.combinable,
        starts_at: new Date(form.starts_at).toISOString().slice(0, 19).replace('T', ' '),
        expires_at: new Date(form.expires_at).toISOString().slice(0, 19).replace('T', ' '),
        status: finalStatus,
        applicable_categories: form.applicable_categories.length > 0 ? form.applicable_categories : null,
        applicable_partners: form.applicable_partners.length > 0 ? form.applicable_partners : null,
        applicable_cities: form.applicable_cities.length > 0 ? form.applicable_cities : null,
        applicable_services: form.applicable_services.length > 0 ? form.applicable_services : null,
        audience_type: form.audience_type,
      };

      const res = await fetch('/api/admin/coupons', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(isEdit ? 'Coupon updated' : 'Coupon created');
        router.push(isEdit ? `/admin/coupons/${couponId}` : `/admin/coupons/${data.id}`);
      } else {
        toast.error(data.error || 'Save failed');
      }
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
      setSavingAs(null);
      setPendingStatus(null);
    }
  };

  // ── Discount preview ───────────────────────────────────────────────────────

  const previewDiscount = () => {
    const val = parseFloat(form.discount_value) || 0;
    const min = parseFloat(form.min_order_value) || 0;
    const max = parseFloat(form.max_discount_amount) || null;
    const sampleOrder = Math.max(min || 500, 500);
    let discount = form.discount_type === 'percentage' ? (sampleOrder * val) / 100 : val;
    if (max) discount = Math.min(discount, max);
    return { sampleOrder, discount: Math.round(discount * 100) / 100, final: sampleOrder - discount };
  };

  const preview = previewDiscount();

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <PermissionGuard permission={isEdit ? 'coupons.edit' : 'coupons.create'}>
      <div className="p-6 lg:p-8 w-full">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 text-[#757575] hover:text-[#1A1A1A] hover:bg-white rounded-xl border border-[#E8E8E8] transition-all"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-[#1A1A1A] tracking-tight">
                {isEdit ? 'Edit Coupon' : 'Create Coupon'}
              </h1>
              <p className="text-[#757575] text-sm mt-0.5">
                {isEdit ? `Editing ${form.code || '…'}` : 'Configure a new discount coupon'}
              </p>
            </div>
          </div>

          {/* Header action buttons */}
          <div className="hidden lg:flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSave('draft')}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E8E8E8] text-sm font-semibold text-[#757575] hover:bg-[#F9F9F9] transition-all disabled:opacity-50"
            >
              {saving && savingAs === 'draft' ? <Loader2 size={14} className="animate-spin" /> : <EyeOff size={14} />}
              Save Draft
            </button>
            {isScheduleMode && (
              <button
                type="button"
                onClick={() => handleSave('scheduled')}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100 transition-all disabled:opacity-50"
              >
                {saving && savingAs === 'scheduled' ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
                Schedule
              </button>
            )}
            {!isScheduleMode && (
              <button
                type="button"
                onClick={() => handleSave('active')}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 shadow-sm"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                {saving && savingAs === 'active' ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {isEdit ? 'Save & Activate' : 'Create & Activate'}
              </button>
            )}
          </div>
        </div>

        {/* ── Two-column layout ────────────────────────────────────────────── */}
        <div className="flex flex-col xl:flex-row gap-6 items-start">

          {/* ── LEFT: Main form sections ─────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* 1. Coupon Code */}
            <Section title="Coupon Code" icon={<Ticket size={15} />}>

              {/* Auto-generate toggle */}
              <Toggle
                checked={form.auto_generate}
                onChange={() => { set('auto_generate', !form.auto_generate); setCodeAvailable(null); }}
                label="Auto-generate code"
                desc="System will create a unique random code"
              />

              {form.auto_generate ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                  <Field label="Code Length" hint="4–20 characters">
                    <input
                      type="number" min="4" max="20"
                      value={form.code_length}
                      onChange={(e) => set('code_length', e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Prefix (optional)" hint="e.g. SAVE, FLAT">
                    <input
                      type="text" maxLength={6}
                      value={form.code_prefix}
                      onChange={(e) => set('code_prefix', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                      placeholder="SAVE"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Generated Code">
                    <div className="flex gap-2">
                      <input
                        type="text" readOnly
                        value={form.code}
                        placeholder="Click →"
                        className={`${inputCls} font-mono font-bold tracking-widest bg-[#F9F9F9] cursor-default`}
                      />
                      <button
                        type="button"
                        onClick={generateCode}
                        disabled={generating}
                        className="flex-shrink-0 px-3 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-60"
                        style={{ backgroundColor: 'var(--primary)' }}
                        title="Generate"
                      >
                        {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      </button>
                    </div>
                  </Field>
                </div>
              ) : (
                <Field label="Coupon Code" required hint="3–50 chars · A-Z, 0-9, underscore, hyphen · Auto-uppercased">
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2">
                      <Ticket size={14} className="text-[#BDBDBD]" />
                    </div>
                    <input
                      type="text"
                      value={form.code}
                      onChange={(e) => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                      placeholder="e.g. SAVE20"
                      maxLength={50}
                      className={`${inputCls} font-mono font-bold tracking-widest pl-10 pr-10`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      {checkingCode && <Loader2 size={14} className="animate-spin text-[#BDBDBD]" />}
                      {!checkingCode && codeAvailable === true  && <Check size={14} className="text-[#2E7D32]" />}
                      {!checkingCode && codeAvailable === false && <AlertTriangle size={14} className="text-red-500" />}
                    </span>
                  </div>
                  {codeAvailable === false && <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1"><AlertTriangle size={11} /> This code is already taken</p>}
                  {codeAvailable === true  && <p className="text-xs text-[#2E7D32] mt-1.5 flex items-center gap-1"><Check size={11} /> Code is available</p>}
                </Field>
              )}
            </Section>

            {/* 2. Coupon Details */}
            <Section title="Coupon Details" icon={<Info size={15} />}>
              <Field label="Coupon Name / Title" required>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="e.g. Summer Sale 20% Off"
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Description" hint="Shown to users when they view the coupon">
                  <textarea
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    placeholder="Brief description of this coupon…"
                    rows={3}
                    className={`${inputCls} resize-none`}
                  />
                </Field>
                <Field label="Terms & Conditions" hint="Optional fine print">
                  <textarea
                    value={form.terms_conditions}
                    onChange={(e) => set('terms_conditions', e.target.value)}
                    placeholder="e.g. Valid on first booking only. Cannot be combined with other offers."
                    rows={3}
                    className={`${inputCls} resize-none`}
                  />
                </Field>
              </div>
            </Section>

            {/* 3. Discount Configuration */}
            <Section title="Discount Configuration" icon={<Percent size={15} />}>

              {/* Discount type selector */}
              <Field label="Discount Type" required>
                <div className="grid grid-cols-2 gap-3">
                  {(['percentage', 'fixed'] as DiscountType[]).map((type) => {
                    const active = form.discount_type === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => set('discount_type', type)}
                        className="flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left"
                        style={active
                          ? { borderColor: 'var(--primary)', backgroundColor: 'var(--light-purple)' }
                          : { borderColor: '#E8E8E8', backgroundColor: 'white' }
                        }
                      >
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                          style={{ backgroundColor: active ? 'var(--primary)' : '#F0F0F0' }}
                        >
                          {type === 'percentage'
                            ? <Percent size={15} className={active ? 'text-white' : 'text-[#757575]'} />
                            : <DollarSign size={15} className={active ? 'text-white' : 'text-[#757575]'} />
                          }
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#1A1A1A]">{type === 'percentage' ? 'Percentage' : 'Fixed Amount'}</p>
                          <p className="text-[11px] text-[#757575]">{type === 'percentage' ? 'e.g. 20% off' : 'e.g. ₹500 off'}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label={form.discount_type === 'percentage' ? 'Discount (%)' : 'Discount Amount (₹)'} required>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#BDBDBD]">
                      {form.discount_type === 'percentage' ? '%' : '₹'}
                    </span>
                    <input
                      type="number" min="0" step="0.01"
                      value={form.discount_value}
                      onChange={(e) => set('discount_value', e.target.value)}
                      placeholder={form.discount_type === 'percentage' ? '20' : '500'}
                      className={`${inputCls} pl-8`}
                    />
                  </div>
                </Field>
                <Field label="Min. Order Value (₹)" hint="0 = no minimum">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#BDBDBD]">₹</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={form.min_order_value}
                      onChange={(e) => set('min_order_value', e.target.value)}
                      placeholder="0"
                      className={`${inputCls} pl-8`}
                    />
                  </div>
                </Field>
                <Field label="Max Discount Cap (₹)" hint="Leave blank for no cap">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#BDBDBD]">₹</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={form.max_discount_amount}
                      onChange={(e) => set('max_discount_amount', e.target.value)}
                      placeholder="Optional"
                      className={`${inputCls} pl-8`}
                    />
                  </div>
                </Field>
              </div>

              {/* Live preview */}
              {form.discount_value && (
                <div className="rounded-xl border border-[#E8E8E8] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[#F0F0F0]" style={{ backgroundColor: 'var(--light-purple)' }}>
                    <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--primary)' }}>Live Preview</p>
                  </div>
                  <div className="px-4 py-3 bg-white flex items-center gap-6 flex-wrap">
                    <div>
                      <p className="text-[10px] text-[#BDBDBD] uppercase tracking-wide">Sample Order</p>
                      <p className="text-base font-bold text-[#1A1A1A]">₹{preview.sampleOrder}</p>
                    </div>
                    <div className="text-[#BDBDBD]">→</div>
                    <div>
                      <p className="text-[10px] text-[#BDBDBD] uppercase tracking-wide">Discount</p>
                      <p className="text-base font-bold text-red-500">−₹{preview.discount}</p>
                    </div>
                    <div className="text-[#BDBDBD]">→</div>
                    <div>
                      <p className="text-[10px] text-[#BDBDBD] uppercase tracking-wide">You Pay</p>
                      <p className="text-base font-bold text-[#2E7D32]">₹{preview.final}</p>
                    </div>
                    {form.code && (
                      <div className="ml-auto">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F9F9F9] border border-[#E8E8E8] rounded-lg text-xs font-mono font-bold text-[#1A1A1A]">
                          <Ticket size={11} style={{ color: 'var(--primary)' }} />
                          {form.code}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Section>

            {/* 4. Usage Restrictions */}
            <Section title="Usage Restrictions" icon={<Shield size={15} />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Total Usage Limit" hint="Leave blank for unlimited">
                  <input
                    type="number" min="1"
                    value={form.max_total_usage}
                    onChange={(e) => set('max_total_usage', e.target.value)}
                    placeholder="Unlimited"
                    className={inputCls}
                  />
                </Field>
                <Field label="Usage Limit Per User" required>
                  <input
                    type="number" min="1"
                    value={form.max_usage_per_user}
                    onChange={(e) => set('max_usage_per_user', e.target.value)}
                    placeholder="1"
                    className={inputCls}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Toggle
                  checked={form.once_per_order}
                  onChange={() => set('once_per_order', !form.once_per_order)}
                  label="Once per order"
                  desc="Can only be applied once per order"
                />
                <Toggle
                  checked={form.combinable}
                  onChange={() => set('combinable', !form.combinable)}
                  label="Combinable"
                  desc="Can be used with other coupons"
                />
              </div>
            </Section>

            {/* 5. Target Audience */}
            <Section title="Target Audience" icon={<Users size={15} />}>
              <Field label="Who can use this coupon?" required>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {AUDIENCE_OPTIONS.map((opt) => {
                    const active = form.audience_type === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => set('audience_type', opt.value)}
                        className="flex flex-col items-center gap-2 p-3.5 rounded-xl border-2 transition-all text-center"
                        style={active
                          ? { borderColor: 'var(--primary)', backgroundColor: 'var(--light-purple)' }
                          : { borderColor: '#E8E8E8', backgroundColor: 'white' }
                        }
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                          style={{ backgroundColor: active ? 'var(--primary)' : '#F0F0F0' }}
                        >
                          <span className={active ? 'text-white' : 'text-[#757575]'}>{opt.icon}</span>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-[#1A1A1A] leading-tight">{opt.label}</p>
                          <p className="text-[10px] text-[#BDBDBD] mt-0.5 leading-tight hidden sm:block">{opt.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Field>

              {/* City filter */}
              {form.audience_type === 'city' && (
                <Field label="Target Cities" hint="Comma-separated list of cities">
                  <div className="relative">
                    <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#BDBDBD]" />
                    <input
                      type="text"
                      value={form.audience_cities}
                      onChange={(e) => {
                        set('audience_cities', e.target.value);
                        set('applicable_cities', e.target.value.split(',').map((c) => c.trim()).filter(Boolean));
                      }}
                      placeholder="e.g. Ahmedabad, Mumbai, Delhi"
                      className={`${inputCls} pl-10`}
                    />
                  </div>
                </Field>
              )}
            </Section>

            {/* 6. Applicability */}
            <Section
              title="Applicability"
              icon={<LayoutGrid size={15} />}
              defaultOpen={false}
              badge={
                (form.applicable_categories.length + form.applicable_partners.length + form.applicable_cities.length) > 0
                  ? `${form.applicable_categories.length + form.applicable_partners.length + form.applicable_cities.length} selected`
                  : undefined
              }
            >
              <p className="text-xs text-[#BDBDBD] -mt-1">Leave all unselected to apply coupon to everything.</p>

              {categories.length > 0 && (
                <Field label="Applicable Categories" hint="Select specific categories or leave blank for all">
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => {
                      const sel = form.applicable_categories.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => toggleId('applicable_categories', cat.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all"
                          style={sel
                            ? { borderColor: 'var(--primary)', backgroundColor: 'var(--light-purple)', color: 'var(--primary)' }
                            : { borderColor: '#E8E8E8', backgroundColor: 'white', color: '#757575' }
                          }
                        >
                          {sel && <Check size={10} />}
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              )}

              {partners.length > 0 && (
                <Field label="Applicable Partners" hint="Select specific partners or leave blank for all">
                  <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                    {partners.map((p) => {
                      const sel = form.applicable_partners.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleId('applicable_partners', p.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all"
                          style={sel
                            ? { borderColor: 'var(--primary)', backgroundColor: 'var(--light-purple)', color: 'var(--primary)' }
                            : { borderColor: '#E8E8E8', backgroundColor: 'white', color: '#757575' }
                          }
                        >
                          {sel && <Check size={10} />}
                          {p.name || p.phone}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              )}

              <Field label="Applicable Cities" hint="Comma-separated. Leave blank for all cities.">
                <div className="relative">
                  <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#BDBDBD]" />
                  <input
                    type="text"
                    value={form.applicable_cities.join(', ')}
                    onChange={(e) => set('applicable_cities', e.target.value.split(',').map((c) => c.trim()).filter(Boolean))}
                    placeholder="e.g. Ahmedabad, Surat, Vadodara"
                    className={`${inputCls} pl-10`}
                  />
                </div>
              </Field>
            </Section>

            {/* 7. Scheduling */}
            <Section title="Scheduling" icon={<Calendar size={15} />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Start Date & Time"
                  required
                  hint={isScheduleMode ? 'Coupon will be scheduled — activates at this time' : 'Set to now — coupon activates immediately on save'}
                >
                  <div className="relative">
                    <input
                      type="datetime-local"
                      value={form.starts_at}
                      min={nowLocal()}
                      onChange={(e) => set('starts_at', e.target.value)}
                      className={inputCls}
                    />
                    {/* Mode pill overlaid on the right */}
                    <span
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold px-2 py-0.5 rounded-full pointer-events-none"
                      style={isScheduleMode
                        ? { backgroundColor: '#EFF6FF', color: '#2563EB' }
                        : { backgroundColor: '#F0FDF4', color: '#16A34A' }
                      }
                    >
                      {isScheduleMode ? 'Scheduled' : 'Now'}
                    </span>
                  </div>
                </Field>
                <Field
                  label="Expiry Date & Time"
                  required
                  hint="Coupon stops working after this time"
                >
                  <input
                    type="datetime-local"
                    value={form.expires_at}
                    min={form.starts_at || nowLocal()}
                    onChange={(e) => set('expires_at', e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>

              {/* Schedule mode banner */}
              {isScheduleMode && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-blue-200 bg-blue-50">
                  <Clock size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 leading-relaxed">
                    Start time is in the future. Saving with <span className="font-bold">Schedule</span> will hold the coupon until{' '}
                    <span className="font-bold">
                      {new Date(form.starts_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}
                    </span>
                    , then auto-activate it.
                  </p>
                </div>
              )}

              <div>
                <p className="text-[11px] text-[#BDBDBD] mb-2">Quick expiry presets (from now):</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: '7 days',  days: 7  },
                    { label: '15 days', days: 15 },
                    { label: '30 days', days: 30 },
                    { label: '60 days', days: 60 },
                    { label: '90 days', days: 90 },
                  ].map(({ label, days }) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => set('expires_at', nowPlusDays(days))}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#E8E8E8] text-[#757575] hover:bg-[#F9F9F9] hover:border-[#BDBDBD] transition-all"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </Section>

            {/* Mobile save actions */}
            <div className="xl:hidden bg-white rounded-2xl border border-[#E8E8E8] shadow-sm px-6 py-5">
              <p className="text-xs font-bold text-[#757575] uppercase tracking-wider mb-4">Save Options</p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleSave('draft')}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#E8E8E8] text-sm font-semibold text-[#757575] hover:bg-[#F9F9F9] transition-all disabled:opacity-50"
                >
                  {saving && savingAs === 'draft' ? <Loader2 size={14} className="animate-spin" /> : <EyeOff size={14} />}
                  Save as Draft
                </button>
                {isScheduleMode ? (
                  <button
                    type="button"
                    onClick={() => handleSave('scheduled')}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-semibold text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100 transition-all disabled:opacity-50"
                  >
                    {saving && savingAs === 'scheduled' ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
                    Schedule
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSave('active')}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 shadow-sm"
                    style={{ backgroundColor: 'var(--primary)' }}
                  >
                    {saving && savingAs === 'active' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {isEdit ? 'Save & Activate' : 'Create & Activate'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Sticky summary sidebar ────────────────────────────── */}
          <div className="w-full xl:w-80 flex-shrink-0 space-y-4 xl:sticky xl:top-6">

            {/* Summary card */}
            <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#F0F0F0]" style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Ticket size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-white font-mono font-bold text-base tracking-widest leading-none">
                      {form.code || (form.auto_generate ? 'AUTO' : 'CODE')}
                    </p>
                    <p className="text-white/70 text-xs mt-0.5">{form.name || 'Untitled coupon'}</p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-3">
                {/* Discount */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[#757575]">
                    <Percent size={12} className="text-[#BDBDBD]" />
                    Discount
                  </div>
                  <span className="text-sm font-bold text-[#1A1A1A]">
                    {form.discount_value
                      ? form.discount_type === 'percentage'
                        ? `${form.discount_value}%`
                        : `₹${form.discount_value}`
                      : <span className="text-[#BDBDBD] font-normal text-xs">Not set</span>
                    }
                  </span>
                </div>

                {/* Min order */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[#757575]">
                    <DollarSign size={12} className="text-[#BDBDBD]" />
                    Min. Order
                  </div>
                  <span className="text-sm font-bold text-[#1A1A1A]">
                    {Number(form.min_order_value) > 0 ? `₹${form.min_order_value}` : <span className="text-[#BDBDBD] font-normal text-xs">None</span>}
                  </span>
                </div>

                {/* Usage */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[#757575]">
                    <Users size={12} className="text-[#BDBDBD]" />
                    Usage Limit
                  </div>
                  <span className="text-sm font-bold text-[#1A1A1A]">
                    {form.max_total_usage || <span className="text-[#BDBDBD] font-normal text-xs">Unlimited</span>}
                  </span>
                </div>

                {/* Audience */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[#757575]">
                    <Users size={12} className="text-[#BDBDBD]" />
                    Audience
                  </div>
                  <span className="text-sm font-bold text-[#1A1A1A] capitalize">
                    {form.audience_type.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Validity */}
                <div className="pt-3 border-t border-[#F0F0F0]">
                  <div className="flex items-center justify-between text-xs text-[#757575] mb-2">
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-[#BDBDBD]" />
                      Validity
                    </div>
                    {/* Schedule mode badge */}
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={isScheduleMode
                        ? { backgroundColor: '#EFF6FF', color: '#2563EB' }
                        : { backgroundColor: '#F0FDF4', color: '#16A34A' }
                      }
                    >
                      {isScheduleMode ? 'Scheduled' : 'Immediate'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#BDBDBD]">From</span>
                      <span className="font-semibold text-[#1A1A1A]">
                        {form.starts_at ? new Date(form.starts_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#BDBDBD]">Until</span>
                      <span className="font-semibold text-[#1A1A1A]">
                        {form.expires_at ? new Date(form.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Flags */}
                {(form.once_per_order || form.combinable) && (
                  <div className="pt-3 border-t border-[#F0F0F0] flex flex-wrap gap-1.5">
                    {form.once_per_order && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-[#F0F0F0] text-[#757575]">
                        <Check size={9} /> Once/order
                      </span>
                    )}
                    {form.combinable && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-[#F0F0F0] text-[#757575]">
                        <Check size={9} /> Combinable
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Desktop save actions */}
            <div className="hidden xl:block bg-white rounded-2xl border border-[#E8E8E8] shadow-sm p-5 space-y-2.5">
              <p className="text-xs font-bold text-[#757575] uppercase tracking-wider mb-3">Save Options</p>

              <button
                type="button"
                onClick={() => handleSave('draft')}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#E8E8E8] text-sm font-semibold text-[#757575] hover:bg-[#F9F9F9] transition-all disabled:opacity-50"
              >
                {saving && savingAs === 'draft' ? <Loader2 size={14} className="animate-spin" /> : <EyeOff size={14} />}
                Save as Draft
              </button>

              {isScheduleMode ? (
                <button
                  type="button"
                  onClick={() => handleSave('scheduled')}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100 transition-all disabled:opacity-50"
                >
                  {saving && savingAs === 'scheduled' ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
                  Schedule
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSave('active')}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 shadow-sm"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  {saving && savingAs === 'active' ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                  {isEdit ? 'Save & Activate' : 'Create & Activate'}
                </button>
              )}

              <p className="text-[10px] text-[#BDBDBD] text-center pt-1">
                {isScheduleMode
                  ? 'Coupon will auto-activate at the scheduled start time.'
                  : 'Draft can be activated later from the coupon detail page.'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Confirmation Modal ──────────────────────────────────────────────── */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="px-6 py-5 border-b border-[#F0F0F0] flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--light-purple)' }}>
                <Zap size={18} style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1A1A1A]">Confirm {pendingStatus === 'active' ? 'Activation' : 'Schedule'}</h3>
                <p className="text-xs text-[#757575] mt-0.5">Please review the coupon details before confirming</p>
              </div>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5">
              <div className="rounded-xl border border-[#E8E8E8] divide-y divide-[#F0F0F0] overflow-hidden">
                {[
                  { label: 'Code',        value: form.code || '(auto-generated)' },
                  { label: 'Discount',    value: form.discount_type === 'percentage' ? `${form.discount_value}%` : `₹${form.discount_value}` + (form.max_discount_amount ? ` (max ₹${form.max_discount_amount})` : '') },
                  { label: 'Audience',    value: form.audience_type.replace(/_/g, ' ') },
                  { label: 'Usage Limit', value: form.max_total_usage || 'Unlimited' },
                  { label: 'Per User',    value: form.max_usage_per_user },
                  { label: 'Valid From',  value: form.starts_at ? new Date(form.starts_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '—' },
                  { label: 'Expires',     value: form.expires_at ? new Date(form.expires_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '—' },
                  { label: 'Status',      value: pendingStatus, highlight: true },
                ].map(({ label, value, highlight }) => (
                  <div key={label} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-[#757575]">{label}</span>
                    <span className={`text-xs font-bold capitalize ${highlight ? '' : 'text-[#1A1A1A]'}`} style={highlight ? { color: 'var(--primary)' } : {}}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 pb-5 flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-[#E8E8E8] rounded-xl text-sm font-semibold text-[#757575] hover:bg-[#F9F9F9] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSave(pendingStatus!)}
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60 shadow-sm"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Confirm & {pendingStatus === 'active' ? 'Activate' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PermissionGuard>
  );
}
