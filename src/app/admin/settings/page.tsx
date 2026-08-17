'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Settings, Globe, Shield, CreditCard, Mail, Upload, X, Save, BarChart3, Database, Download, RefreshCw, FileText, Table2, Palette, Bell, Smartphone, MessageSquare, Eye, EyeOff } from 'lucide-react';
import PermissionGuard from '@/components/admin/PermissionGuard';

type SettingsData = Record<string, Record<string, string>>;

type TableStat = { name: string; rows: number };

const EXPORTABLE_TABLES = [
  'roles', 'permissions', 'role_permissions', 'users', 'pages',
  'settings', 'password_resets', 'delete_account_requests', 'activity_logs',
];

const TABS = [
  { id: 'general',       label: 'General',       icon: <Settings size={15} /> },
  { id: 'social',        label: 'Social',        icon: <Globe size={15} /> },
  { id: 'auth',          label: 'Auth',          icon: <Shield size={15} /> },
  { id: 'payment',       label: 'Payment',       icon: <CreditCard size={15} /> },
  { id: 'mail',          label: 'Mail',          icon: <Mail size={15} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={15} /> },
  { id: 'analytics',     label: 'Analytics',     icon: <BarChart3 size={15} /> },
  { id: 'appearance',    label: 'Appearance',    icon: <Palette size={15} /> },
  { id: 'database',      label: 'Database',      icon: <Database size={15} /> },
  { id: 'app-links',     label: 'App Links',     icon: <Smartphone size={15} /> },
  { id: 'sms',           label: 'SMS / OTP',     icon: <MessageSquare size={15} /> },
];

// Reusable field — brand focus ring
const Field = ({
  label, group, field, type = 'text', placeholder = '', hint = '',
  get, set,
}: {
  label: string; group: string; field: string; type?: string;
  placeholder?: string; hint?: string;
  get: (g: string, k: string) => string;
  set: (g: string, k: string, v: string) => void;
}) => (
  <div>
    <label className="block text-xs font-semibold text-[#757575] mb-1.5 uppercase tracking-wide">{label}</label>
    <input
      type={type}
      value={get(group, field)}
      onChange={(e) => set(group, field, e.target.value)}
      placeholder={placeholder}
      className="w-full bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl px-4 py-2.5 text-sm text-[#2D2D2D] placeholder-[#757575] focus:outline-none focus:ring-2 focus:ring-[#4A2372] focus:border-transparent focus:bg-white transition-all"
    />
    {hint && <p className="text-xs text-[#757575] mt-1.5">{hint}</p>}
  </div>
);

// Secret field with show/hide toggle
const SecretField = ({
  label, group, field, placeholder = '', hint = '',
  get, set,
}: {
  label: string; group: string; field: string;
  placeholder?: string; hint?: string;
  get: (g: string, k: string) => string;
  set: (g: string, k: string, v: string) => void;
}) => {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="block text-xs font-semibold text-[#757575] mb-1.5 uppercase tracking-wide">{label}</label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={get(group, field)}
          onChange={(e) => set(group, field, e.target.value)}
          placeholder={placeholder}
          className="w-full bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl px-4 py-2.5 pr-11 text-sm text-[#2D2D2D] placeholder-[#757575] focus:outline-none focus:ring-2 focus:ring-[#4A2372] focus:border-transparent focus:bg-white transition-all font-mono"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-[#757575] hover:text-[#2D2D2D] transition-colors"
          tabIndex={-1}
          title={visible ? 'Hide secret' : 'Show secret'}
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {hint && <p className="text-xs text-[#757575] mt-1.5">{hint}</p>}
    </div>
  );
};

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get('tab') || 'general';

  const [settings, setSettings] = useState<SettingsData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  // Favicon upload state
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);

  // ── Database export state ──────────────────────────────────────────────────
  const [dbTables, setDbTables] = useState<TableStat[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);
  const [exportingTable, setExportingTable] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<'sql' | 'structure' | 'csv'>('sql');

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (res.ok) setSettings(data.settings || {});
    } catch { toast.error('Failed to load settings'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  // ── Database helpers ───────────────────────────────────────────────────────
  const fetchDbStats = useCallback(async () => {
    setDbLoading(true);
    try {
      const res = await fetch('/api/admin/settings/db-export', { method: 'POST' });
      const data = await res.json();
      if (res.ok) setDbTables(data.tables || []);
      else toast.error(data.error || 'Failed to load table stats');
    } catch { toast.error('Failed to load database info'); }
    finally { setDbLoading(false); }
  }, []);

  // Load DB stats when the database tab is opened
  useEffect(() => {
    if (activeTab === 'database' && dbTables.length === 0) {
      fetchDbStats();
    }
  }, [activeTab, dbTables.length, fetchDbStats]);

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportAll = async () => {
    setExportingAll(true);
    try {
      const res = await fetch(`/api/admin/settings/db-export?format=${exportFormat === 'csv' ? 'sql' : exportFormat}`);
      if (!res.ok) { toast.error('Export failed'); return; }
      const blob = await res.blob();
      const suffix = exportFormat === 'structure' ? '_structure' : '';
      triggerDownload(blob, `workwala${suffix}_${Date.now()}.sql`);
      toast.success(exportFormat === 'structure' ? 'Database structure exported' : 'Full database exported');
    } catch { toast.error('Export failed'); }
    finally { setExportingAll(false); }
  };

  const handleExportTable = async (tableName: string, format: 'sql' | 'structure' | 'csv') => {
    setExportingTable(tableName);
    try {
      const res = await fetch(`/api/admin/settings/db-export?format=${format}&table=${tableName}`);
      if (!res.ok) { toast.error('Export failed'); return; }
      const blob = await res.blob();
      const ext = format === 'csv' ? 'csv' : 'sql';
      const suffix = format === 'structure' ? '_structure' : '';
      triggerDownload(blob, `${tableName}${suffix}_${Date.now()}.${ext}`);
      const label = format === 'structure' ? 'Structure' : ext.toUpperCase();
      toast.success(`Table \`${tableName}\` exported as ${label}`);
    } catch { toast.error('Export failed'); }
    finally { setExportingTable(null); }
  };

  const get = (group: string, key: string) => settings[group]?.[key] || '';
  const set = (group: string, key: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [group]: { ...(prev[group] || {}), [key]: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const allSettings: Record<string, string> = {};
      Object.values(settings).forEach((group) => {
        Object.entries(group).forEach(([k, v]) => { allSettings[k] = v; });
      });

      let res;
      // Use FormData if either logo or favicon file is present
      if (logoFile || faviconFile) {
        const fd = new FormData();
        if (logoFile) fd.append('site_logo_file', logoFile);
        if (faviconFile) fd.append('site_favicon_file', faviconFile);
        Object.entries(allSettings).forEach(([k, v]) => fd.append(k, v));
        res = await fetch('/api/admin/settings', { method: 'POST', body: fd });
      } else {
        res = await fetch('/api/admin/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(allSettings),
        });
      }

      if (res.ok) {
        toast.success('Settings saved');
        setLogoFile(null);
        setLogoPreview(null);
        setFaviconFile(null);
        setFaviconPreview(null);
        fetchSettings();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed to save');
      }
    } catch { toast.error('Something went wrong'); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 w-full">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-[var(--light-purple)] rounded-xl w-36" />
          <div className="h-12 bg-[var(--light-purple)] rounded-2xl w-96" />
          <div className="h-64 bg-[var(--light-purple)] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#2D2D2D] tracking-tight">Settings</h1>
          <p className="text-[#757575] text-sm mt-1">Manage your application configuration</p>
        </div>
        {/* Save button — primary purple */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-sm hover:-translate-y-px"
          style={{ backgroundColor: 'var(--primary)' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--primary-dark)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--primary)')}
        >
          <Save size={15} />
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* Tab bar — light purple background */}
      <div className="flex items-center gap-1 bg-[var(--light-purple)] p-1 rounded-2xl w-fit mb-6 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => router.push(`/admin/settings?tab=${tab.id}`)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white shadow-sm'
                : 'text-[#757575] hover:text-[#2D2D2D]'
            }`}
            style={activeTab === tab.id ? { color: 'var(--primary)' } : undefined}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-sm overflow-hidden">

        {/* ── General ─────────────────────────────────────────────── */}
        {activeTab === 'general' && (
          <div className="p-6 space-y-8">

            {/* ── Site Info ── */}
            <div className="space-y-5">
              <div>
                <h2 className="font-semibold text-[#2D2D2D]">General Settings</h2>
                <p className="text-xs text-[#757575] mt-0.5">Basic site information and contact details</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Site Name"       group="general" field="site_name"             placeholder="WorkWala"                     get={get} set={set} />
                <Field label="Tagline"         group="general" field="site_tagline"          placeholder="Build something amazing"      get={get} set={set} />
                <Field label="Site URL"        group="general" field="site_url"              placeholder="https://example.com"          get={get} set={set} hint="Canonical base URL — used in meta tags and sitemaps" />
                {/* Site Language — drives <html lang> and OG locale for SEO/AEO */}
                <div>
                  <label className="block text-xs font-semibold text-[#757575] mb-1.5 uppercase tracking-wide">Site Language</label>
                  <select
                    value={get('general', 'site_language') || 'en'}
                    onChange={(e) => set('general', 'site_language', e.target.value)}
                    className="w-full bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl px-4 py-2.5 text-sm text-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent focus:bg-white transition-all"
                  >
                    <option value="en">English (en)</option>
                    <option value="en-US">English US (en-US)</option>
                    <option value="en-GB">English UK (en-GB)</option>
                    <option value="hi">Hindi (hi)</option>
                    <option value="fr">French (fr)</option>
                    <option value="de">German (de)</option>
                    <option value="es">Spanish (es)</option>
                    <option value="pt">Portuguese (pt)</option>
                    <option value="ar">Arabic (ar)</option>
                    <option value="zh">Chinese (zh)</option>
                    <option value="ja">Japanese (ja)</option>
                    <option value="ko">Korean (ko)</option>
                    <option value="ru">Russian (ru)</option>
                    <option value="it">Italian (it)</option>
                    <option value="nl">Dutch (nl)</option>
                    <option value="tr">Turkish (tr)</option>
                  </select>
                  <p className="text-xs text-[#757575] mt-1.5">Sets <code className="font-mono bg-[#F0F0F0] px-1 rounded">&lt;html lang&gt;</code> and Open Graph locale — important for SEO</p>
                </div>
                <Field label="Copyright Text"  group="general" field="copyright_text"        placeholder="© 2026 WorkWala. All rights reserved." get={get} set={set} />
                <Field label="Support Email"   group="general" field="contact_support_email" type="email" placeholder="support@example.com"  get={get} set={set} />
                <Field label="Business Email"  group="general" field="business_email"        type="email" placeholder="business@example.com" get={get} set={set} />
                <Field label="Phone"           group="general" field="contact_phone"         placeholder="+1 234 567 890"               get={get} set={set} />
                <Field label="Address"         group="general" field="address"               placeholder="123 Main St, City"            get={get} set={set} />
              </div>
            </div>

            {/* ── Logo & Favicon ── */}
            <div className="space-y-5 pt-2 border-t border-[#E0E0E0]">
              <p className="text-xs font-semibold text-[#757575] uppercase tracking-widest">Logo &amp; Favicon</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Site Logo */}
                <div className="bg-[#F9F9F9] border border-[#E0E0E0] rounded-2xl p-4 space-y-3">
                  <label className="block text-xs font-semibold text-[#757575] uppercase tracking-wide">Site Logo</label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 border border-[#E0E0E0] rounded-xl overflow-hidden bg-white flex items-center justify-center flex-shrink-0">
                      {(logoPreview || get('general', 'site_logo')) ? (
                        <img
                          src={logoPreview || get('general', 'site_logo')}
                          alt="Logo"
                          className="max-h-14 max-w-full object-contain p-1"
                        />
                      ) : (
                        <Upload size={18} className="text-[#bdbdbd]" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="cursor-pointer inline-flex items-center gap-2 bg-[var(--light-purple)] hover:opacity-90 text-[var(--primary)] text-xs font-semibold px-3 py-2 rounded-xl transition-colors">
                        <Upload size={13} />
                        {get('general', 'site_logo') || logoPreview ? 'Replace' : 'Upload'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); }
                          }}
                        />
                      </label>
                      {logoPreview && (
                        <button
                          type="button"
                          onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                          className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 font-medium transition-colors"
                        >
                          <X size={11} /> Remove
                        </button>
                      )}
                      <p className="text-[11px] text-[#757575]">PNG, SVG, JPG · max 2 MB</p>
                    </div>
                  </div>
                </div>

                {/* Favicon */}
                <div className="bg-[#F9F9F9] border border-[#E0E0E0] rounded-2xl p-4 space-y-3">
                  <label className="block text-xs font-semibold text-[#757575] uppercase tracking-wide">Favicon</label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 border border-[#E0E0E0] rounded-xl overflow-hidden bg-white flex items-center justify-center flex-shrink-0">
                      {(faviconPreview || get('general', 'site_favicon')) ? (
                        <img
                          src={faviconPreview || get('general', 'site_favicon')}
                          alt="Favicon"
                          className="w-10 h-10 object-contain"
                        />
                      ) : (
                        <Upload size={18} className="text-[#bdbdbd]" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="cursor-pointer inline-flex items-center gap-2 bg-[var(--light-purple)] hover:opacity-90 text-[var(--primary)] text-xs font-semibold px-3 py-2 rounded-xl transition-colors">
                        <Upload size={13} />
                        {get('general', 'site_favicon') || faviconPreview ? 'Replace' : 'Upload'}
                        <input
                          type="file"
                          accept="image/x-icon,image/png,image/svg+xml,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) { setFaviconFile(f); setFaviconPreview(URL.createObjectURL(f)); }
                          }}
                        />
                      </label>
                      {faviconPreview && (
                        <button
                          type="button"
                          onClick={() => { setFaviconFile(null); setFaviconPreview(null); }}
                          className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 font-medium transition-colors"
                        >
                          <X size={11} /> Remove
                        </button>
                      )}
                      <p className="text-[11px] text-[#757575]">ICO, PNG, SVG · 32×32 or 64×64 recommended</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── SEO / Meta Tags ── */}
            <div className="space-y-5 pt-2 border-t border-[#E0E0E0]">
              <div>
                <p className="text-xs font-semibold text-[#757575] uppercase tracking-widest">SEO &amp; Meta Tags</p>
                <p className="text-xs text-[#757575] mt-1">These values are injected into every page's <code className="font-mono bg-[#F0F0F0] px-1 rounded">&lt;head&gt;</code> for search engines and social sharing.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field
                  label="Meta Title"
                  group="general" field="meta_title"
                  placeholder="WorkWala — Build something amazing"
                  hint="Shown in browser tab and search results (50–60 chars recommended)"
                  get={get} set={set}
                />
                <Field
                  label="Meta Author"
                  group="general" field="meta_author"
                  placeholder="WorkWala Team"
                  hint="Author name injected into the author meta tag"
                  get={get} set={set}
                />
              </div>

              {/* Meta Description — full width textarea */}
              <div>
                <label className="block text-xs font-semibold text-[#757575] mb-1.5 uppercase tracking-wide">Meta Description</label>
                <textarea
                  value={get('general', 'meta_description')}
                  onChange={(e) => set('general', 'meta_description', e.target.value)}
                  rows={3}
                  placeholder="A short description of your site shown in search results and social previews."
                  className="w-full bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl px-4 py-2.5 text-sm text-[#2D2D2D] placeholder-[#757575] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent focus:bg-white transition-all resize-none leading-relaxed"
                />
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-xs text-[#757575]">150–160 characters recommended</p>
                  <p className={`text-xs font-mono ${get('general', 'meta_description').length > 160 ? 'text-red-500' : 'text-[#757575]'}`}>
                    {get('general', 'meta_description').length} / 160
                  </p>
                </div>
              </div>

              {/* Meta Keywords */}
              <div>
                <label className="block text-xs font-semibold text-[#757575] mb-1.5 uppercase tracking-wide">Meta Keywords</label>
                <input
                  type="text"
                  value={get('general', 'meta_keywords')}
                  onChange={(e) => set('general', 'meta_keywords', e.target.value)}
                  placeholder="nextjs, admin, dashboard, saas"
                  className="w-full bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl px-4 py-2.5 text-sm text-[#2D2D2D] placeholder-[#757575] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent focus:bg-white transition-all"
                />
                <p className="text-xs text-[#757575] mt-1.5">Comma-separated keywords (optional — most search engines ignore this tag)</p>
              </div>
            </div>

            {/* ── Open Graph / Social Sharing ── */}
            <div className="space-y-5 pt-2 border-t border-[#E0E0E0]">
              <div>
                <p className="text-xs font-semibold text-[#757575] uppercase tracking-widest">Open Graph &amp; Social Sharing</p>
                <p className="text-xs text-[#757575] mt-1">Controls how your site looks when shared on Twitter, Facebook, WhatsApp, etc.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field
                  label="OG Title"
                  group="general" field="og_title"
                  placeholder="WorkWala — Build something amazing"
                  hint="Defaults to Meta Title if left empty"
                  get={get} set={set}
                />
                <Field
                  label="OG Image URL"
                  group="general" field="meta_og_image"
                  placeholder="https://example.com/og-image.png"
                  hint="1200×630 px recommended — absolute URL"
                  get={get} set={set}
                />
              </div>

              {/* OG Description */}
              <div>
                <label className="block text-xs font-semibold text-[#757575] mb-1.5 uppercase tracking-wide">OG Description</label>
                <textarea
                  value={get('general', 'og_description')}
                  onChange={(e) => set('general', 'og_description', e.target.value)}
                  rows={2}
                  placeholder="Defaults to Meta Description if left empty"
                  className="w-full bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl px-4 py-2.5 text-sm text-[#2D2D2D] placeholder-[#757575] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent focus:bg-white transition-all resize-none leading-relaxed"
                />
              </div>

              {/* OG image preview */}
              {get('general', 'meta_og_image') && (
                <div className="rounded-2xl border border-[#E0E0E0] overflow-hidden">
                  <div className="bg-[#F9F9F9] px-4 py-2 border-b border-[#E0E0E0]">
                    <p className="text-[11px] font-semibold text-[#757575] uppercase tracking-widest">OG Image Preview</p>
                  </div>
                  <div className="p-4">
                    <img
                      src={get('general', 'meta_og_image')}
                      alt="OG preview"
                      className="w-full max-w-sm rounded-xl border border-[#E0E0E0] object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                </div>
              )}

              {/* Info banner */}
              <div className="flex items-start gap-3 bg-[var(--light-purple)] border border-[color-mix(in_srgb,var(--primary)_20%,transparent)] rounded-xl px-4 py-3.5">
                <svg className="w-4 h-4 text-[var(--primary)] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-[var(--primary)]">
                  All meta and OG tags are injected server-side into every page's <code className="font-mono bg-[color-mix(in_srgb,var(--primary)_12%,white)] px-1 rounded">&lt;head&gt;</code> automatically after saving. Changes take effect on the next page load.
                </p>
              </div>
            </div>

          </div>
        )}

        {/* ── Social ──────────────────────────────────────────────── */}
        {activeTab === 'social' && (
          <div className="p-6 space-y-6">
            <div>
              <h2 className="font-semibold text-[#2D2D2D]">Social Links</h2>
              <p className="text-xs text-[#757575] mt-0.5">Connect your social media profiles</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {[
                { label: 'Facebook', field: 'social_facebook', placeholder: 'https://facebook.com/yourpage' },
                { label: 'Twitter / X', field: 'social_twitter', placeholder: 'https://twitter.com/yourhandle' },
                { label: 'Instagram', field: 'social_instagram', placeholder: 'https://instagram.com/yourhandle' },
                { label: 'LinkedIn', field: 'social_linkedin', placeholder: 'https://linkedin.com/company/yourco' },
                { label: 'YouTube', field: 'social_youtube', placeholder: 'https://youtube.com/@yourchannel' },
              ].map((s) => (
                <Field key={s.field} label={s.label} group="social" field={s.field} placeholder={s.placeholder} get={get} set={set} />
              ))}
            </div>
          </div>
        )}

        {/* ── Auth ────────────────────────────────────────────────── */}
        {activeTab === 'auth' && (
          <div className="p-6 space-y-5">
            <div>
              <h2 className="font-semibold text-[#2D2D2D]">Auth & Login</h2>
              <p className="text-xs text-[#757575] mt-0.5">Configure login methods available to users</p>
            </div>

            {/* Manual Login */}
            <div className="border border-[#E0E0E0] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 bg-[#F9F9F9]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white border border-[#E0E0E0] flex items-center justify-center shadow-sm">
                    <svg className="w-5 h-5" style={{ color: 'var(--primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#2D2D2D]">Manual Login</p>
                    <p className="text-xs text-[#757575]">Allow users to sign in with email & password</p>
                  </div>
                </div>
                {/* Toggle */}
                <button
                  type="button"
                  onClick={() => set('auth', 'manual_login_enabled', get('auth', 'manual_login_enabled') === '0' ? '1' : '0')}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0`}
                  style={{ backgroundColor: get('auth', 'manual_login_enabled') !== '0' ? 'var(--primary)' : '#E0E0E0' }}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${get('auth', 'manual_login_enabled') !== '0' ? 'translate-x-5' : ''}`} />
                </button>
              </div>
              {get('auth', 'manual_login_enabled') !== '0' && (
                <div className="px-5 py-4 border-t border-[#E0E0E0]">
                  <div className="flex items-start gap-2 p-3 rounded-xl text-xs" style={{ background: 'var(--light-purple)', border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)', color: 'var(--primary)' }}>
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>Manual login is <strong>enabled</strong>. Users will see the email &amp; password form on the login page. Disable this to hide the form and only allow social login.</span>
                  </div>
                </div>
              )}
              {get('auth', 'manual_login_enabled') === '0' && (
                <div className="px-5 py-4 border-t border-[#E0E0E0]">
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                    <span>Manual login is <strong>disabled</strong>. The email &amp; password form will be hidden on the login page. Make sure at least one social login is enabled.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Google */}
            <div className="border border-[#E0E0E0] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 bg-[#F9F9F9]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white border border-[#E0E0E0] flex items-center justify-center shadow-sm">
                    <svg viewBox="0 0 24 24" className="w-5 h-5">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#2D2D2D]">Google Login</p>
                    <p className="text-xs text-[#757575]">Sign in with Google account</p>
                  </div>
                </div>
                {/* Toggle — brand purple when on */}
                <button
                  type="button"
                  onClick={() => set('auth', 'google_login_enabled', get('auth', 'google_login_enabled') === '1' ? '0' : '1')}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0`}
                  style={{ backgroundColor: get('auth', 'google_login_enabled') === '1' ? 'var(--primary)' : '#E0E0E0' }}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${get('auth', 'google_login_enabled') === '1' ? 'translate-x-5' : ''}`} />
                </button>
              </div>
              {get('auth', 'google_login_enabled') === '1' && (
                <div className="px-5 py-5 border-t border-[#E0E0E0] space-y-4">
                  <p className="text-[11px] font-semibold text-[#757575] uppercase tracking-widest">Google OAuth Credentials</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Client ID" group="auth" field="google_client_id" placeholder="xxxx.apps.googleusercontent.com" get={get} set={set} />
                    <Field label="Client Secret" group="auth" field="google_client_secret" type="password" placeholder="GOCSPX-••••••••" get={get} set={set} />
                  </div>
                  {/* Info box — light purple tint */}
                  <div className="flex items-start gap-2 p-3 rounded-xl text-xs" style={{ background: 'var(--light-purple)', border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)', color: 'var(--primary)' }}>
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>Get credentials from <strong>Google Cloud Console → APIs & Services → Credentials</strong>. Redirect URI: <code className="font-mono px-1 rounded" style={{ background: 'color-mix(in srgb, var(--primary) 15%, white)' }}>{typeof window !== 'undefined' ? window.location.origin : ''}/api/auth/callback/google</code></span>
                  </div>
                </div>
              )}
            </div>

            {/* Apple */}
            <div className="border border-[#E0E0E0] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 bg-[#F9F9F9]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white border border-[#E0E0E0] flex items-center justify-center shadow-sm">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#2D2D2D]" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#2D2D2D]">Apple Login</p>
                    <p className="text-xs text-[#757575]">Sign in with Apple ID</p>
                  </div>
                </div>
                {/* Toggle — brand purple when on */}
                <button
                  type="button"
                  onClick={() => set('auth', 'apple_login_enabled', get('auth', 'apple_login_enabled') === '1' ? '0' : '1')}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0`}
                  style={{ backgroundColor: get('auth', 'apple_login_enabled') === '1' ? 'var(--primary)' : '#E0E0E0' }}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${get('auth', 'apple_login_enabled') === '1' ? 'translate-x-5' : ''}`} />
                </button>
              </div>
              {get('auth', 'apple_login_enabled') === '1' && (
                <div className="px-5 py-5 border-t border-[#E0E0E0] space-y-4">
                  <p className="text-[11px] font-semibold text-[#757575] uppercase tracking-widest">Apple OAuth Credentials</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Client ID (Service ID)" group="auth" field="apple_client_id" placeholder="com.yourapp.service" get={get} set={set} />
                    <Field label="Client Secret (Key)" group="auth" field="apple_client_secret" type="password" placeholder="••••••••" get={get} set={set} />
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-xl text-xs" style={{ background: 'var(--light-purple)', border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)', color: 'var(--primary)' }}>
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>Get credentials from <strong>Apple Developer → Certificates, Identifiers & Profiles → Keys</strong>. Redirect URI: <code className="font-mono px-1 rounded" style={{ background: 'color-mix(in srgb, var(--primary) 15%, white)' }}>{typeof window !== 'undefined' ? window.location.origin : ''}/api/auth/callback/apple</code></span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Payment ─────────────────────────────────────────────── */}
        {activeTab === 'payment' && (
          <div className="p-6 space-y-6">
            <style>{`
              @keyframes payment-fade-in {
                from { opacity: 0; transform: translateY(10px); }
                to   { opacity: 1; transform: translateY(0); }
              }
              .payment-panel {
                animation: payment-fade-in 0.25s ease both;
              }
            `}</style>

            <div>
              <h2 className="font-semibold text-[#2D2D2D]">Razorpay Payment</h2>
              <p className="text-xs text-[#757575] mt-0.5">Configure your payment gateway credentials</p>
            </div>

            {/* Mode toggle */}
            <div className="flex items-center gap-2 p-1 rounded-xl w-fit" style={{ background: 'var(--light-purple)' }}>
              {['test', 'live'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => set('payment', 'razorpay_mode', mode)}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 capitalize ${
                    get('payment', 'razorpay_mode') === mode
                      ? mode === 'live'
                        ? 'bg-[#2E7D32] text-white shadow-sm scale-[1.03]'
                        : 'bg-white shadow-sm scale-[1.03]'
                      : 'text-[#757575] hover:text-[#2D2D2D] hover:scale-[1.02]'
                  }`}
                  style={get('payment', 'razorpay_mode') === mode && mode !== 'live' ? { color: 'var(--primary)' } : undefined}
                >
                  {mode}
                </button>
              ))}
            </div>

            {get('payment', 'razorpay_mode') !== 'live' && (
              <div key="test" className="payment-panel space-y-4">
                <p className="text-xs font-semibold text-[#757575] uppercase tracking-widest">Test Credentials</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Test Key ID" group="payment" field="razorpay_key_id_test" placeholder="rzp_test_…" get={get} set={set} />
                  <SecretField label="Test Key Secret" group="payment" field="razorpay_key_secret_test" placeholder="••••••••" get={get} set={set} />
                </div>
              </div>
            )}
            {get('payment', 'razorpay_mode') === 'live' && (
              <div key="live" className="payment-panel space-y-4">
                <p className="text-xs font-semibold text-[#757575] uppercase tracking-widest">Live Credentials</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Live Key ID" group="payment" field="razorpay_key_id_live" placeholder="rzp_live_…" get={get} set={set} />
                  <SecretField label="Live Key Secret" group="payment" field="razorpay_key_secret_live" placeholder="••••••••" get={get} set={set} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Mail ────────────────────────────────────────────────── */}
        {activeTab === 'mail' && (
          <div className="p-6 space-y-6">
            <div>
              <h2 className="font-semibold text-[#2D2D2D]">Mail Configuration</h2>
              <p className="text-xs text-[#757575] mt-0.5">SMTP settings for outgoing emails</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="SMTP Host" group="mail" field="mail_host" placeholder="smtp.gmail.com" get={get} set={set} />
              <Field label="SMTP Port" group="mail" field="mail_port" placeholder="587" get={get} set={set} />
              <Field label="Username" group="mail" field="mail_username" type="email" placeholder="you@gmail.com" get={get} set={set} />
              <Field label="Password" group="mail" field="mail_password" type="password" placeholder="App password" get={get} set={set} />
              <Field label="From Address" group="mail" field="mail_from_address" type="email" placeholder="noreply@example.com" get={get} set={set} />
              <Field label="From Name" group="mail" field="mail_from_name" placeholder="WorkWala" get={get} set={set} />
              <div>
                <label className="block text-xs font-semibold text-[#757575] mb-1.5 uppercase tracking-wide">Encryption</label>
                <select
                  value={get('mail', 'mail_encryption')}
                  onChange={(e) => set('mail', 'mail_encryption', e.target.value)}
                  className="w-full bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl px-4 py-2.5 text-sm text-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[#4A2372] focus:border-transparent focus:bg-white transition-all"
                >
                  <option value="tls">TLS</option>
                  <option value="ssl">SSL</option>
                  <option value="none">None</option>
                </select>
              </div>
            </div>
          </div>
        )}
        {/* ── Analytics ───────────────────────────────────────────── */}
        {activeTab === 'analytics' && (
          <div className="p-6 space-y-6">
            <div>
              <h2 className="font-semibold text-[#2D2D2D]">Google Analytics</h2>
              <p className="text-xs text-[#757575] mt-0.5">
                Paste your complete Google Analytics tracking script. It will be injected into every page automatically.
              </p>
            </div>

            {/* Info banner */}
            <div className="flex items-start gap-3 bg-[var(--light-purple)] border border-[color-mix(in_srgb,var(--primary)_20%,transparent)] rounded-xl px-4 py-3.5">
              <svg className="w-4 h-4 text-[var(--primary)] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-xs text-[var(--primary)] space-y-1">
                <p>
                  Get your tracking code from{' '}
                  <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2 hover:opacity-80">
                    Google Analytics
                  </a>
                  {' '}→ Admin → Data Streams → select your stream → View tag instructions.
                </p>
                <p>Paste the <strong>complete script</strong> including the <code className="font-mono bg-[#e8d5f5] px-1 rounded">&lt;script&gt;</code> tags. It loads on every public and admin page after you save.</p>
              </div>
            </div>

            {/* Script textarea */}
            <div>
              <label className="block text-xs font-semibold text-[#757575] mb-1.5 uppercase tracking-wide">
                Google Analytics Code (Complete Script)
              </label>
              <textarea
                value={get('analytics', 'ga_script')}
                onChange={(e) => set('analytics', 'ga_script', e.target.value)}
                rows={12}
                spellCheck={false}
                placeholder={`<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n  gtag('config', 'G-XXXXXXXXXX');\n</script>`}
                className="w-full bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl px-4 py-3 text-sm text-[#2D2D2D] placeholder-[#bdbdbd] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent focus:bg-white transition-all resize-y leading-relaxed"
              />
              <p className="text-xs text-[#757575] mt-2">
                Leave empty to disable tracking. Changes take effect after saving and a page reload.
              </p>
            </div>

            {/* Status indicator */}
            <div className="flex items-center gap-2.5 px-4 py-3 bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${get('analytics', 'ga_script') ? 'bg-[#2E7D32]' : 'bg-[#bdbdbd]'}`} />
              <p className="text-xs text-[#757575]">
                {get('analytics', 'ga_script')
                  ? <><span className="font-semibold text-[#2E7D32]">Script configured</span> — will be injected on all pages after saving.</>
                  : <><span className="font-semibold text-[#757575]">No script configured</span> — tracking is disabled.</>
                }
              </p>
            </div>
          </div>
        )}

        {/* ── Appearance ──────────────────────────────────────────── */}
        {activeTab === 'appearance' && (
          <div className="p-6 space-y-8">
            <div>
              <h2 className="font-semibold text-[#2D2D2D]">Appearance & Brand Colours</h2>
              <p className="text-xs text-[#757575] mt-0.5">
                Changes apply globally — all users see the updated colours on their next page load.
              </p>
            </div>

            {/* Info banner */}
            <div className="flex items-start gap-3 bg-[var(--light-purple)] border border-[color-mix(in_srgb,var(--primary)_20%,transparent)] rounded-xl px-4 py-3.5">
              <Palette size={15} className="text-[var(--primary)] mt-0.5 flex-shrink-0" />
              <p className="text-xs text-[var(--primary)]">
                Pick a <strong>preset palette</strong> or fine-tune individual colours below.
                Hit <strong>Save Changes</strong> at the top to apply. The page will reload automatically to preview the new palette.
              </p>
            </div>

            {/* ── Preset palettes ── */}
            {(() => {
              const PRESETS = [
                { name: 'Purple (Default)', primary: '#4A2372', accent: '#C2185B', sidebar: '#2D1B45' },
                { name: 'Ocean Blue',       primary: '#1565C0', accent: '#00ACC1', sidebar: '#0D2B4E' },
                { name: 'Forest Green',     primary: '#2E7D32', accent: '#F57F17', sidebar: '#1B3A1F' },
                { name: 'Crimson Red',      primary: '#B71C1C', accent: '#E65100', sidebar: '#3B0A0A' },
                { name: 'Slate',            primary: '#37474F', accent: '#546E7A', sidebar: '#1C2B33' },
                { name: 'Indigo',           primary: '#283593', accent: '#AD1457', sidebar: '#1A2060' },
                { name: 'Teal',             primary: '#00695C', accent: '#FF6F00', sidebar: '#00352E' },
                { name: 'Rose Gold',        primary: '#880E4F', accent: '#BF360C', sidebar: '#3E0028' },
              ];
              return (
                <div>
                  <p className="text-xs font-semibold text-[#757575] uppercase tracking-widest mb-3">Preset Palettes</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {PRESETS.map((p) => {
                      const isActive =
                        (get('appearance', 'color_primary') || '#4A2372') === p.primary &&
                        (get('appearance', 'color_accent')  || '#C2185B') === p.accent &&
                        (get('appearance', 'color_sidebar') || '#2D1B45') === p.sidebar;
                      return (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => {
                            set('appearance', 'color_primary', p.primary);
                            set('appearance', 'color_accent',  p.accent);
                            set('appearance', 'color_sidebar', p.sidebar);
                          }}
                          className={`group relative flex flex-col gap-2.5 p-3.5 rounded-2xl border-2 transition-all text-left ${
                            isActive
                              ? 'border-[var(--primary)] bg-[var(--light-purple)]'
                              : 'border-[#E0E0E0] bg-white hover:border-[#bdbdbd] hover:shadow-sm'
                          }`}
                        >
                          {/* Colour swatches */}
                          <div className="flex items-center gap-1.5">
                            <span className="w-7 h-7 rounded-lg shadow-sm flex-shrink-0" style={{ backgroundColor: p.sidebar }} />
                            <span className="w-7 h-7 rounded-lg shadow-sm flex-shrink-0" style={{ backgroundColor: p.primary }} />
                            <span className="w-7 h-7 rounded-lg shadow-sm flex-shrink-0" style={{ backgroundColor: p.accent }} />
                          </div>
                          <p className="text-xs font-semibold text-[#2D2D2D] leading-tight">{p.name}</p>
                          {isActive && (
                            <span className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--primary)' }}>
                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── Custom colour pickers ── */}
            <div>
              <p className="text-xs font-semibold text-[#757575] uppercase tracking-widest mb-4">Custom Colours</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {[
                  { label: 'Primary Colour',  field: 'color_primary', hint: 'Buttons, focus rings, active states' },
                  { label: 'Accent Colour',   field: 'color_accent',  hint: 'Sidebar active item, badges, icons' },
                  { label: 'Sidebar Colour',  field: 'color_sidebar', hint: 'Sidebar & mobile top-bar background' },
                ].map(({ label, field, hint }) => {
                  const defaults: Record<string, string> = {
                    color_primary: '#4A2372',
                    color_accent:  '#C2185B',
                    color_sidebar: '#2D1B45',
                  };
                  const val = get('appearance', field) || defaults[field];
                  return (
                    <div key={field} className="bg-[#F9F9F9] border border-[#E0E0E0] rounded-2xl p-4 space-y-3">
                      <label className="block text-xs font-semibold text-[#757575] uppercase tracking-wide">{label}</label>
                      {/* Colour preview + picker */}
                      <div className="flex items-center gap-3">
                        <label className="relative cursor-pointer flex-shrink-0">
                          <span
                            className="block w-12 h-12 rounded-xl border-2 border-white shadow-md transition-transform hover:scale-105"
                            style={{ backgroundColor: val }}
                          />
                          <input
                            type="color"
                            value={val}
                            onChange={(e) => set('appearance', field, e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                        </label>
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            value={val}
                            maxLength={7}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) set('appearance', field, v);
                            }}
                            className="w-full bg-white border border-[#E0E0E0] rounded-xl px-3 py-2 text-sm font-mono text-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                            placeholder="#000000"
                          />
                          <p className="text-[11px] text-[#757575] mt-1.5 leading-tight">{hint}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Live preview strip ── */}
            <div>
              <p className="text-xs font-semibold text-[#757575] uppercase tracking-widest mb-3">Live Preview</p>
              <div className="rounded-2xl border border-[#E0E0E0] overflow-hidden">
                {/* Sidebar strip */}
                <div
                  className="flex items-center gap-3 px-5 py-3"
                  style={{ backgroundColor: get('appearance', 'color_sidebar') || '#2D1B45' }}
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: get('appearance', 'color_accent') || '#C2185B' }}
                  >
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <span className="text-white text-xs font-bold">WorkWala</span>
                  <div className="flex-1" />
                  {/* Active nav item */}
                  <span
                    className="text-white text-[11px] font-semibold px-3 py-1 rounded-lg"
                    style={{ backgroundColor: get('appearance', 'color_accent') || '#C2185B' }}
                  >
                    Dashboard
                  </span>
                  <span className="text-white/40 text-[11px] px-3 py-1">Users</span>
                  <span className="text-white/40 text-[11px] px-3 py-1">Settings</span>
                </div>
                {/* Content strip */}
                <div className="bg-[#F9F9F9] px-5 py-4 flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    className="text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-sm"
                    style={{ backgroundColor: get('appearance', 'color_primary') || '#4A2372' }}
                  >
                    Primary Button
                  </button>
                  <span
                    className="text-white text-xs font-semibold px-3 py-1 rounded-full"
                    style={{ backgroundColor: get('appearance', 'color_accent') || '#C2185B' }}
                  >
                    Badge
                  </span>
                  <div
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${get('appearance', 'color_primary') || '#4A2372'} 10%, white)`,
                      color: get('appearance', 'color_primary') || '#4A2372',
                    }}
                  >
                    <Palette size={11} />
                    Tint Background
                  </div>
                  <input
                    readOnly
                    value="Focus ring preview"
                    className="text-xs px-3 py-1.5 rounded-xl border-2 bg-white text-[#2D2D2D] outline-none"
                    style={{ borderColor: get('appearance', 'color_primary') || '#4A2372' }}
                  />
                </div>
              </div>
            </div>

            {/* Reset to defaults */}
            <div className="flex items-center justify-between pt-2 border-t border-[#E0E0E0]">
              <p className="text-xs text-[#757575]">Reset all colours back to the original purple brand palette.</p>
              <button
                type="button"
                onClick={() => {
                  set('appearance', 'color_primary', '#4A2372');
                  set('appearance', 'color_accent',  '#C2185B');
                  set('appearance', 'color_sidebar', '#2D1B45');
                  toast.success('Reset to default palette — click Save to apply');
                }}
                className="inline-flex items-center gap-2 text-xs font-semibold text-[#757575] hover:text-[#2D2D2D] border border-[#E0E0E0] hover:border-[#bdbdbd] px-4 py-2 rounded-xl transition-all"
              >
                Reset to Default
              </button>
            </div>
          </div>
        )}

        {/* ── Notifications ───────────────────────────────────────── */}
        {activeTab === 'notifications' && (
          <div className="p-6 space-y-6">

            {/* Header */}
            <div>
              <h2 className="font-semibold text-[#2D2D2D]">Push Notifications</h2>
              <p className="text-xs text-[#757575] mt-0.5">Configure Firebase Admin SDK to send push notifications to your users</p>
            </div>

            {/* Config status banner */}
            {(() => {
              const configured =
                get('notifications', 'fcm_project_id').trim() !== '' &&
                get('notifications', 'fcm_client_email').trim() !== '' &&
                get('notifications', 'fcm_private_key').trim() !== '';
              return configured ? (
                <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3.5">
                  <svg className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-xs text-green-700">
                    <p><strong>Firebase is configured.</strong> Push notifications will work as long as the Enable toggle is on and valid device tokens are registered.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
                  <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <div className="text-xs text-amber-700 space-y-1">
                    <p><strong>Firebase is not fully configured.</strong> Push notifications will not work until you complete the configuration.</p>
                    <p>
                      View the{' '}
                      <a
                        href="https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold underline underline-offset-2 hover:opacity-80"
                      >
                        setup guide
                      </a>
                      {' '}for step-by-step instructions.
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Master toggle */}
            <div className="border border-[#E0E0E0] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 bg-[#F9F9F9]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white border border-[#E0E0E0] flex items-center justify-center shadow-sm">
                    <Bell size={17} style={{ color: 'var(--primary)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#2D2D2D]">Enable Push Notifications</p>
                    <p className="text-xs text-[#757575]">Allow the app to send push notifications to subscribed users via Firebase</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => set('notifications', 'push_notifications_enabled', get('notifications', 'push_notifications_enabled') === '1' ? '0' : '1')}
                  className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
                  style={{ backgroundColor: get('notifications', 'push_notifications_enabled') === '1' ? 'var(--primary)' : '#E0E0E0' }}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${get('notifications', 'push_notifications_enabled') === '1' ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            </div>

            {/* Notification event toggles */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-[#757575] uppercase tracking-widest">Notification Events</p>
              {[
                { field: 'notify_new_user',      label: 'New User Registration',  desc: 'Notify admins when a new user registers' },
                { field: 'notify_login',          label: 'User Login Alert',       desc: 'Notify admins on each user login' },
                { field: 'notify_delete_request', label: 'Delete Account Request', desc: 'Notify admins when a user requests account deletion' },
                { field: 'notify_payment',        label: 'Payment Events',         desc: 'Notify admins on successful or failed payments' },
              ].map(({ field, label, desc }) => (
                <div key={field} className="flex items-center justify-between px-5 py-3.5 border border-[#E0E0E0] rounded-2xl bg-white hover:bg-[#F9F9F9] transition-colors">
                  <div className="min-w-0 pr-4">
                    <p className="text-sm font-medium text-[#2D2D2D]">{label}</p>
                    <p className="text-xs text-[#757575] mt-0.5">{desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => set('notifications', field, get('notifications', field) === '1' ? '0' : '1')}
                    className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
                    style={{ backgroundColor: get('notifications', field) === '1' ? 'var(--primary)' : '#E0E0E0' }}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${get('notifications', field) === '1' ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
              ))}
            </div>

            {/* Firebase Admin SDK credentials */}
            <div className="space-y-5 pt-2 border-t border-[#E0E0E0]">
              <div>
                <p className="text-xs font-semibold text-[#757575] uppercase tracking-widest">Firebase Admin SDK Credentials</p>
                <p className="text-xs text-[#757575] mt-1">
                  Get these from{' '}
                  <a
                    href="https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline underline-offset-2 hover:opacity-80"
                    style={{ color: 'var(--primary)' }}
                  >
                    Firebase Console
                  </a>
                  {' '}→ Project Settings → Service Accounts → Generate new private key → download the JSON file.
                </p>
              </div>

              {/* Project ID */}
              <div>
                <label className="block text-xs font-semibold text-[#757575] mb-1.5 uppercase tracking-wide">Firebase Project ID</label>
                <input
                  type="text"
                  value={get('notifications', 'fcm_project_id')}
                  onChange={(e) => set('notifications', 'fcm_project_id', e.target.value)}
                  placeholder="your-project-id"
                  className="w-full bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl px-4 py-2.5 text-sm text-[#2D2D2D] placeholder-[#757575] focus:outline-none focus:ring-2 focus:ring-[#4A2372] focus:border-transparent focus:bg-white transition-all"
                />
                <p className="text-xs text-[#757575] mt-1.5">Project ID from Firebase Console</p>
              </div>

              {/* Client Email */}
              <div>
                <label className="block text-xs font-semibold text-[#757575] mb-1.5 uppercase tracking-wide">Firebase Client Email</label>
                <input
                  type="email"
                  value={get('notifications', 'fcm_client_email')}
                  onChange={(e) => set('notifications', 'fcm_client_email', e.target.value)}
                  placeholder="firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
                  className="w-full bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl px-4 py-2.5 text-sm text-[#2D2D2D] placeholder-[#757575] focus:outline-none focus:ring-2 focus:ring-[#4A2372] focus:border-transparent focus:bg-white transition-all"
                />
                <p className="text-xs text-[#757575] mt-1.5">Service account email from Firebase</p>
              </div>

              {/* Private Key */}
              <div>
                <label className="block text-xs font-semibold text-[#757575] mb-1.5 uppercase tracking-wide">
                  Firebase Private Key{' '}
                  <span className="normal-case font-normal text-[#757575]">— Keep Secret</span>
                </label>
                <textarea
                  value={get('notifications', 'fcm_private_key')}
                  onChange={(e) => set('notifications', 'fcm_private_key', e.target.value)}
                  rows={6}
                  spellCheck={false}
                  placeholder={'-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'}
                  className="w-full bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl px-4 py-3 text-sm font-mono text-[#2D2D2D] placeholder-[#bdbdbd] focus:outline-none focus:ring-2 focus:ring-[#4A2372] focus:border-transparent focus:bg-white transition-all resize-y leading-relaxed"
                />
                <p className="text-xs text-[#757575] mt-1.5">Private key from Firebase service account JSON file. Paste the full key including the <code className="font-mono bg-[#F0F0F0] px-1 rounded">-----BEGIN-----</code> and <code className="font-mono bg-[#F0F0F0] px-1 rounded">-----END-----</code> lines.</p>
              </div>

              {/* Security note */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <span>These credentials are used <strong>server-side only</strong> to send notifications via the Firebase Admin SDK. They are never exposed to the browser.</span>
              </div>
            </div>

          </div>
        )}

        {/* ── Database ────────────────────────────────────────────── */}
        {activeTab === 'database' && (
          <div className="p-6 space-y-6">
            {/* Header row */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-[#2D2D2D]">Database Export</h2>
                <p className="text-xs text-[#757575] mt-0.5">
                  Export your database tables as SQL dumps or CSV files for backup or migration.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchDbStats}
                disabled={dbLoading}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#757575] hover:text-[#4A2372] transition-colors disabled:opacity-50 flex-shrink-0"
              >
                <RefreshCw size={13} className={dbLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            {/* Warning banner */}
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
              <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-xs text-amber-700">
                <strong>Sensitive data warning:</strong> Exported files may contain passwords, API keys, and personal data.
                Store them securely and never share them publicly.
              </p>
            </div>

            {/* Full DB export card */}
            <div className="border border-[#E0E0E0] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 bg-[#F9F9F9]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--primary) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)' }}>
                    <Database size={17} style={{ color: 'var(--primary)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#2D2D2D]">Full Database</p>
                    <p className="text-xs text-[#757575]">
                      {exportFormat === 'structure'
                        ? `All ${EXPORTABLE_TABLES.length} tables — structure only (no data)`
                        : exportFormat === 'csv'
                        ? `All ${EXPORTABLE_TABLES.length} tables — complete SQL dump`
                        : `All ${EXPORTABLE_TABLES.length} tables — complete SQL dump`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleExportAll}
                  disabled={exportingAll}
                  className="inline-flex items-center gap-2 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-sm hover:-translate-y-px"
                  style={{ backgroundColor: 'var(--primary)' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--primary-dark)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--primary)')}
                >
                  {exportingAll
                    ? <RefreshCw size={12} className="animate-spin" />
                    : <Download size={12} />
                  }
                  {exportingAll
                    ? 'Exporting…'
                    : exportFormat === 'structure'
                    ? 'Export Structure'
                    : 'Export SQL'}
                </button>
              </div>
            </div>

            {/* Per-table section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-[#757575] uppercase tracking-widest">Export Individual Table</p>
                {/* Format toggle */}
                <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: 'var(--light-purple)' }}>
                  {(['sql', 'structure', 'csv'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setExportFormat(fmt)}
                      className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold transition-all uppercase ${
                        exportFormat === fmt
                          ? 'bg-white shadow-sm'
                          : 'text-[#757575] hover:text-[#2D2D2D]'
                      }`}
                      style={exportFormat === fmt ? { color: 'var(--primary)' } : undefined}
                    >
                      {fmt === 'csv' ? <Table2 size={11} /> : <FileText size={11} />}
                      {fmt === 'structure' ? 'Structure' : fmt}
                    </button>
                  ))}
                </div>
              </div>

              {dbLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-14 bg-[var(--light-purple)] rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="border border-[#E0E0E0] rounded-2xl overflow-hidden divide-y divide-[#E0E0E0]">
                  {dbTables.map((tbl) => (
                    <div key={tbl.name} className="flex items-center justify-between px-5 py-3.5 hover:bg-[#F9F9F9] transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-[var(--light-purple)] flex items-center justify-center flex-shrink-0">
                          <Table2 size={13} style={{ color: 'var(--primary)' }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#2D2D2D] font-mono">{tbl.name}</p>
                          <p className="text-xs text-[#757575]">
                            {tbl.rows.toLocaleString()} row{tbl.rows !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleExportTable(tbl.name, exportFormat)}
                        disabled={exportingTable === tbl.name}
                        className="inline-flex items-center gap-1.5 bg-[var(--light-purple)] hover:opacity-90 disabled:opacity-50 text-[var(--primary)] text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-all flex-shrink-0"
                      >
                        {exportingTable === tbl.name
                          ? <RefreshCw size={11} className="animate-spin" />
                          : <Download size={11} />
                        }
                        {exportingTable === tbl.name
                          ? 'Exporting…'
                          : exportFormat === 'structure'
                          ? 'Structure'
                          : `Export ${exportFormat.toUpperCase()}`}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Info note */}
            <div className="flex items-start gap-2 p-3 bg-[var(--light-purple)] border border-[color-mix(in_srgb,var(--primary)_20%,transparent)] rounded-xl text-xs text-[var(--primary)]">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                <strong>SQL</strong> exports include <code className="font-mono bg-[color-mix(in_srgb,var(--primary)_8%,white)] px-1 rounded">DROP TABLE</code> + <code className="font-mono bg-[color-mix(in_srgb,var(--primary)_8%,white)] px-1 rounded">CREATE TABLE</code> + <code className="font-mono bg-[color-mix(in_srgb,var(--primary)_8%,white)] px-1 rounded">INSERT</code> statements — suitable for full restore.{' '}
                <strong>Structure</strong> exports include only <code className="font-mono bg-[color-mix(in_srgb,var(--primary)_8%,white)] px-1 rounded">DROP TABLE</code> + <code className="font-mono bg-[color-mix(in_srgb,var(--primary)_8%,white)] px-1 rounded">CREATE TABLE</code> — no data rows, useful for schema migration.{' '}
                <strong>CSV</strong> exports contain raw row data — suitable for spreadsheets and data analysis.
                All exports are logged in activity logs.
              </span>
            </div>
          </div>
        )}

        {/* ── App Links ───────────────────────────────────────────── */}
        {activeTab === 'app-links' && (
          <div className="p-6 space-y-6">
            <div>
              <h2 className="font-semibold text-[#2D2D2D]">App Links</h2>
              <p className="text-xs text-[#757575] mt-0.5">Store links for your mobile apps on Google Play and the Apple App Store</p>
            </div>

            {/* Play Store */}
            <div className="border border-[#E0E0E0] rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 bg-[#F9F9F9] border-b border-[#E0E0E0]">
                <div className="w-9 h-9 rounded-xl bg-white border border-[#E0E0E0] flex items-center justify-center shadow-sm flex-shrink-0">
                  {/* Google Play icon */}
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                    <path d="M3.18 23.76c.3.17.65.2.98.1l11.37-11.37L11.9 9.86 3.18 23.76z" fill="#EA4335"/>
                    <path d="M20.7 10.5l-2.9-1.66-3.47 3.47 3.47 3.47 2.93-1.68c.84-.48.84-1.6-.03-2.6z" fill="#FBBC05"/>
                    <path d="M3.18.24C2.85.1 2.47.16 2.18.4L13.55 11.76l3.25-3.25L3.18.24z" fill="#4285F4"/>
                    <path d="M2.18.4C1.9.65 1.75 1.07 1.75 1.6v20.8c0 .53.15.95.43 1.2l.12.1 11.65-11.65v-.27L2.3.3l-.12.1z" fill="#34A853"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#2D2D2D]">Google Play Store</p>
                  <p className="text-xs text-[#757575]">Android app listing URLs</p>
                </div>
              </div>
              <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field
                  label="For Partner"
                  group="app_links"
                  field="playstore_partner_url"
                  placeholder="https://play.google.com/store/apps/details?id=com.yourapp.partner"
                  hint="Google Play link for the Partner app"
                  get={get}
                  set={set}
                />
                <Field
                  label="For Customer"
                  group="app_links"
                  field="playstore_customer_url"
                  placeholder="https://play.google.com/store/apps/details?id=com.yourapp.customer"
                  hint="Google Play link for the Customer app"
                  get={get}
                  set={set}
                />
              </div>
            </div>

            {/* App Store */}
            <div className="border border-[#E0E0E0] rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 bg-[#F9F9F9] border-b border-[#E0E0E0]">
                <div className="w-9 h-9 rounded-xl bg-white border border-[#E0E0E0] flex items-center justify-center shadow-sm flex-shrink-0">
                  {/* Apple App Store icon */}
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#007AFF">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#2D2D2D]">Apple App Store</p>
                  <p className="text-xs text-[#757575]">iOS app listing URLs</p>
                </div>
              </div>
              <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field
                  label="For Partner"
                  group="app_links"
                  field="appstore_partner_url"
                  placeholder="https://apps.apple.com/app/your-partner-app/id000000000"
                  hint="App Store link for the Partner app"
                  get={get}
                  set={set}
                />
                <Field
                  label="For Customer"
                  group="app_links"
                  field="appstore_customer_url"
                  placeholder="https://apps.apple.com/app/your-customer-app/id000000001"
                  hint="App Store link for the Customer app"
                  get={get}
                  set={set}
                />
              </div>
            </div>

            {/* Info note */}
            <div className="flex items-start gap-3 bg-[var(--light-purple)] border border-[color-mix(in_srgb,var(--primary)_20%,transparent)] rounded-xl px-4 py-3.5">
              <Smartphone size={15} className="text-[var(--primary)] mt-0.5 flex-shrink-0" />
              <p className="text-xs text-[var(--primary)]">
                These links are saved to settings and can be used anywhere in your app — e.g. footer, landing page, or in-app prompts. Leave a field empty to hide that store button.
              </p>
            </div>
          </div>
        )}

        {/* ── SMS / OTP ───────────────────────────────────────────── */}
        {activeTab === 'sms' && (
          <div className="p-6 space-y-6">
            <div>
              <h2 className="font-semibold text-[#2D2D2D]">SMS / OTP Settings</h2>
              <p className="text-xs text-[#757575] mt-0.5">Configure MSG91 to send OTP messages to partners during login</p>
            </div>

            {/* Config status banner */}
            {(() => {
              const configured =
                get('sms', 'msg91_auth_key').trim() !== '' &&
                get('sms', 'msg91_template_id').trim() !== '';
              return configured ? (
                <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3.5">
                  <svg className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-green-700"><strong>MSG91 is configured.</strong> OTPs will be sent via SMS to partners.</p>
                </div>
              ) : (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
                  <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <p className="text-xs text-amber-700">
                    <strong>MSG91 is not configured.</strong> OTPs will be logged to the server console (dev mode) until you add your credentials.
                  </p>
                </div>
              );
            })()}

            {/* MSG91 fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field
                label="MSG91 Auth Key"
                group="sms"
                field="msg91_auth_key"
                type="password"
                placeholder="Enter your MSG91 auth key"
                hint="Found in MSG91 Dashboard → API → Auth Key"
                get={get}
                set={set}
              />
              <Field
                label="Sender ID"
                group="sms"
                field="msg91_sender_id"
                placeholder="WRKWLA"
                hint="6-character sender ID approved by MSG91"
                get={get}
                set={set}
              />
              <Field
                label="OTP Template ID"
                group="sms"
                field="msg91_template_id"
                placeholder="Enter your MSG91 template ID"
                hint="Flow template ID from MSG91 Dashboard"
                get={get}
                set={set}
              />
              <Field
                label="OTP Expiry (minutes)"
                group="sms"
                field="msg91_otp_expiry_minutes"
                type="number"
                placeholder="5"
                hint="How long the OTP remains valid (default: 5 minutes)"
                get={get}
                set={set}
              />
            </div>

            {/* Info note */}
            <div className="flex items-start gap-3 bg-[var(--light-purple)] border border-[color-mix(in_srgb,var(--primary)_20%,transparent)] rounded-xl px-4 py-3.5">
              <MessageSquare size={15} className="text-[var(--primary)] mt-0.5 flex-shrink-0" />
              <p className="text-xs text-[var(--primary)]">
                MSG91 uses a Flow template to send OTPs. Create a template in{' '}
                <a
                  href="https://control.msg91.com/app/flow"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline underline-offset-2 hover:opacity-80"
                >
                  MSG91 Flow
                </a>{' '}
                with a variable <code className="font-mono bg-[color-mix(in_srgb,var(--primary)_8%,white)] px-1 rounded">VAR1</code> for the OTP value.
                If credentials are not set, OTPs are printed to the server console for local development.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <PermissionGuard permission="settings.view">
      <Suspense fallback={<div className="p-8 text-[#757575] text-sm">Loading settings…</div>}>
        <SettingsContent />
      </Suspense>
    </PermissionGuard>
  );
}
