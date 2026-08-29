'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  LayoutDashboard, Users, Shield, Key, FileText,
  Settings, LogOut, Menu, X, ChevronRight,
  Globe, Bell, Search, ExternalLink, Activity, BarChart3,
  Briefcase, Tag, Languages, Wallet,
  // notification panel icons
  CheckCheck, ArrowRight, Loader2, Check,
} from 'lucide-react';
import SearchModal from '@/components/admin/SearchModal';
import { apiFetch } from '@/lib/apiFetch';

// Each nav item declares which permission slug gates it
interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  permission: string;
  children?: { label: string; href: string }[];
}

const NAV: NavItem[] = [
  { label: 'Dashboard',   href: '/admin/dashboard',   icon: <LayoutDashboard size={16} />, permission: 'dashboard.view' },
  { label: 'Analytics',   href: '/admin/analytics',   icon: <BarChart3 size={16} />,       permission: 'dashboard.view' },
  { label: 'Users',       href: '/admin/users',        icon: <Users size={16} />,           permission: 'users.view' },
  { label: 'Roles',       href: '/admin/roles',        icon: <Shield size={16} />,          permission: 'roles.view' },
  { label: 'Permissions', href: '/admin/permissions',  icon: <Key size={16} />,             permission: 'permissions.view' },
  { label: 'Partners',      href: '/admin/partners',       icon: <Briefcase size={16} />, permission: 'users.view' },
  { label: 'Withdrawals',   href: '/admin/withdrawals',    icon: <Wallet size={16} />,    permission: 'users.view' },
  { label: 'Categories',    href: '/admin/categories',     icon: <Tag size={16} />,       permission: 'users.view' },
  { label: 'Coupons',       href: '/admin/coupons',        icon: <Tag size={16} />,       permission: 'coupons.view' },
  { label: 'Pages',         href: '/admin/pages',         icon: <FileText size={16} />,  permission: 'pages.view' },
  { label: 'Translations',  href: '/admin/translations',  icon: <Languages size={16} />, permission: 'settings.view' },
  { label: 'Notifications', href: '/admin/notifications', icon: <Bell size={16} />,      permission: 'notifications.view' },
  { label: 'Activity Logs', href: '/admin/activity-logs', icon: <Activity size={16} />, permission: 'activity_logs.view' },
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: <Settings size={16} />,
    permission: 'settings.view',
    children: [
      { label: 'General',       href: '/admin/settings?tab=general' },
      { label: 'Social',        href: '/admin/settings?tab=social' },
      { label: 'Auth',          href: '/admin/settings?tab=auth' },
      { label: 'Payment',       href: '/admin/settings?tab=payment' },
      { label: 'Mail',          href: '/admin/settings?tab=mail' },
      { label: 'Notifications', href: '/admin/settings?tab=notifications' },
      { label: 'Analytics',     href: '/admin/settings?tab=analytics' },
      { label: 'Appearance',    href: '/admin/settings?tab=appearance' },
      { label: 'Database',      href: '/admin/settings?tab=database' },
      { label: 'App Links',     href: '/admin/settings?tab=app-links' },
      { label: 'SMS / OTP',     href: '/admin/settings?tab=sms' },
    ],
  },
];

interface AdminUser { name: string; email: string; avatar?: string; role_name: string; }
interface SiteInfo  { site_name: string; site_logo: string; }

/* ─────────────────────────────────────────────────────────────
   Brand block — logo image if set, otherwise icon + site name
───────────────────────────────────────────────────────────── */
function BrandBlock({ site, iconSize = 'md' }: { site: SiteInfo; iconSize?: 'sm' | 'md' }) {
  const sz = iconSize === 'sm' ? { wrap: 'w-7 h-7', icon: 'w-3.5 h-3.5' } : { wrap: 'w-8 h-8', icon: 'w-4 h-4' };

  if (site.site_logo) {
    return (
      <div className="bg-white rounded-lg p-2 flex items-center justify-center flex-shrink-0">
        <img
          src={site.site_logo}
          alt={site.site_name || 'Logo'}
          className="h-10 max-w-[160px] object-contain"
        />
      </div>
    );
  }

  return (
    <>
      <div
        className={`${sz.wrap} rounded-lg flex items-center justify-center flex-shrink-0 shadow-md`}
        style={{ backgroundColor: 'var(--accent)', boxShadow: '0 4px 12px color-mix(in srgb, var(--accent) 40%, transparent)' }}
      >
        <svg className={`${sz.icon} text-white`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <span className={`text-white font-bold tracking-tight truncate ${iconSize === 'sm' ? 'text-sm' : 'text-[13px]'}`}>
        {site.site_name || 'Linko'}
      </span>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Sidebar inner content (shared between desktop + mobile)
───────────────────────────────────────────────────────────── */
function SidebarInner({
  user, permissions, pathname, settingsOpen, setSettingsOpen,
  loggingOut, handleLogout, onNavClick, site,
}: {
  user: AdminUser | null;
  permissions: string[];
  pathname: string;
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  loggingOut: boolean;
  handleLogout: () => void;
  onNavClick?: () => void;
  site: SiteInfo;
}) {
  const isActive = (href: string) => {
    if (href === '/admin/dashboard') return pathname === href;
    return pathname.startsWith(href.split('?')[0]);
  };

  const visibleNav = NAV.filter((item) => permissions.includes(item.permission));

  return (
    <div className="flex flex-col h-full select-none">
      {/* ── Brand ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] flex-shrink-0 min-h-[68px]">
        <BrandBlock site={site} iconSize="md" />
        {/* "Admin Console" sub-label — only shown when text brand (no logo) */}
        {!site.site_logo && (
          <p className="text-[10px] text-white/40 font-medium hidden">Admin Console</p>
        )}
      </div>

      {/* ── Nav ────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto sidebar-scroll">
        <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.12em] px-2 mb-2 mt-1">
          Navigation
        </p>

        <div className="space-y-0.5">
          {visibleNav.map((item) => {
            const active = isActive(item.href);

            if (item.children) {
              return (
                <div key={item.href}>
                  <button
                    onClick={() => setSettingsOpen(!settingsOpen)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors group ${
                      active
                        ? 'text-white bg-white/10'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/[0.05]'
                    }`}
                  >
                    <span
                      className="flex-shrink-0"
                      style={{ color: active ? 'var(--accent)' : undefined }}
                    >
                      {/* fallback muted colour when inactive */}
                      <span className={active ? '' : 'text-white/30 group-hover:text-white/50'}>
                        {item.icon}
                      </span>
                    </span>
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronRight
                      size={12}
                      className={`flex-shrink-0 text-white/30 transition-transform duration-200 ${settingsOpen ? 'rotate-90' : ''}`}
                    />
                  </button>

                  {settingsOpen && (
                    <div className="mt-0.5 ml-[18px] pl-3 border-l border-white/[0.07] space-y-0.5 pb-1">
                      {item.children.map((child) => {
                        const childActive = typeof window !== 'undefined'
                          ? pathname + window.location.search === child.href
                          : false;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={onNavClick}
                            className={`block px-2.5 py-1.5 rounded-md text-[12px] transition-colors ${
                              childActive
                                ? 'font-semibold bg-white/10'
                                : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                            }`}
                            style={childActive ? { color: 'var(--accent)', backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)' } : undefined}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavClick}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors group ${
                  active
                    ? 'text-white'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/[0.05]'
                }`}
                style={active ? { backgroundColor: 'var(--accent)' } : undefined}
              >
                <span className={`flex-shrink-0 ${active ? 'text-white' : 'text-white/30 group-hover:text-white/50'}`}>
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white/70 flex-shrink-0" />
                )}
              </Link>
            );
          })}
        </div>

        {/* ── External ─────────────────────────────────────── */}
        <div className="mt-4 pt-3 border-t border-white/[0.06]">
          <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.12em] px-2 mb-2">
            External
          </p>
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-colors group"
          >
            <Globe size={16} className="text-white/30 group-hover:text-white/50 flex-shrink-0" />
            <span className="flex-1">View Site</span>
            <ExternalLink size={11} className="text-white/20 flex-shrink-0" />
          </Link>
        </div>
      </nav>

      {/* ── User footer ────────────────────────────────────── */}
      <div className="px-3 pb-3 pt-2 border-t border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
          {/* Avatar — uses --primary → --accent gradient */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold overflow-hidden flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}
          >
            {user?.avatar
              ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              : <span>{user?.name?.[0]?.toUpperCase() ?? 'A'}</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-white/80 truncate leading-none">{user?.name ?? 'Admin'}</p>
            <p className="text-[10px] text-white/40 truncate mt-0.5">{user?.role_name ?? 'Administrator'}</p>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title="Sign out"
            className="p-1.5 text-white/30 rounded-lg transition-colors flex-shrink-0 hover:bg-white/10"
            style={{ '--hover-color': 'var(--accent)' } as React.CSSProperties}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '')}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Notification Panel — dropdown triggered by the Bell button
───────────────────────────────────────────────────────────── */
interface NotificationItem {
  id: number;
  user_name: string;
  action: string;
  module: string;
  target_name: string | null;
  description: string | null;
  created_at: string;
}

// Maps module names to a short colour token for the icon dot
const MODULE_COLOR: Record<string, string> = {
  users:         'var(--primary)',
  roles:         '#7C3AED',
  permissions:   '#0891B2',
  pages:         '#059669',
  settings:      'var(--accent)',
  auth:          '#D97706',
};

function moduleColor(mod: string): string {
  return MODULE_COLOR[mod.toLowerCase()] ?? '#9CA3AF';
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const DISMISSED_KEY = 'notif_dismissed_ids';

function getDismissedIds(): Set<number> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw) as number[]) : new Set();
  } catch { return new Set(); }
}

function saveDismissedIds(ids: Set<number>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

function NotificationPanel({ onClose, onAllRead }: { onClose: () => void; onAllRead: () => void }) {
  const [items, setItems]         = useState<NotificationItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const panelRef                  = useRef<HTMLDivElement>(null);

  // Load notifications — filter out already-dismissed IDs from localStorage
  useEffect(() => {
    fetch('/api/admin/notifications')
      .then((r) => r.json())
      .then((d) => {
        const dismissed = getDismissedIds();
        const all: NotificationItem[] = d.notifications ?? [];
        setItems(all.filter((n) => !dismissed.has(n.id)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // slight delay so the button click that opened us doesn't immediately close
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Dismiss a single notification — persist to localStorage so it stays gone
  const dismissOne = (id: number) => {
    const dismissed = getDismissedIds();
    dismissed.add(id);
    saveDismissedIds(dismissed);
    setItems((prev) => prev.filter((n) => n.id !== id));
  };

  const markAllRead = async () => {
    await apiFetch('/api/admin/notifications/read', { method: 'POST' });
    // Persist all current IDs as dismissed
    const dismissed = getDismissedIds();
    items.forEach((n) => dismissed.add(n.id));
    saveDismissedIds(dismissed);
    setItems([]);
    onAllRead();
    // Don't close — let the user see the empty "all caught up" state
  };

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-[360px] bg-white rounded-2xl shadow-2xl border border-[#E8E8E8] overflow-hidden z-50"
      style={{ maxHeight: '480px', display: 'flex', flexDirection: 'column' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0F0F0]">
        <div>
          <p className="text-[13px] font-bold text-[#2D2D2D]">Notifications</p>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">Recent activity in your admin</p>
        </div>
        {items.length > 0 && (
          <button
            onClick={markAllRead}
            title="Mark all as read"
            className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors text-[#757575] hover:bg-[#F9F9F9]"
            style={{ color: 'var(--primary)' }}
          >
            <CheckCheck size={13} />
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-[#bdbdbd]" />
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Bell size={28} className="text-[#E0E0E0] mb-2" />
            <p className="text-sm text-[#757575]">No new notifications</p>
            <p className="text-xs text-[#bdbdbd] mt-1">You&apos;re all caught up!</p>
          </div>
        )}

        {!loading && items.map((item) => (
          <div
            key={item.id}
            className="group flex items-start gap-3 px-4 py-3 hover:bg-[#FAFAFA] transition-colors border-b border-[#F7F7F7] last:border-0"
          >
            {/* Module colour dot */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-white text-[10px] font-bold uppercase"
              style={{ backgroundColor: moduleColor(item.module) }}
            >
              {item.module.slice(0, 2)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-[#2D2D2D] leading-snug">
                <span className="font-normal text-[#757575]">{item.user_name}</span>
                {' '}
                <span style={{ color: 'var(--accent)' }}>{item.action}</span>
                {item.target_name ? (
                  <> <span className="text-[#2D2D2D]">{item.target_name}</span></>
                ) : null}
              </p>
              {item.description && (
                <p className="text-[11px] text-[#9CA3AF] mt-0.5 truncate">{item.description}</p>
              )}
              <p className="text-[10px] text-[#bdbdbd] mt-1 capitalize">
                {item.module} · {timeAgo(item.created_at)}
              </p>
            </div>

            {/* Per-item dismiss button */}
            <button
              onClick={() => dismissOne(item.id)}
              title="Mark as read"
              className="flex-shrink-0 mt-0.5 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity text-[#bdbdbd] hover:text-[#757575] hover:bg-[#F0F0F0]"
            >
              <Check size={13} />
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-[#F0F0F0] flex-shrink-0">
        <Link
          href="/admin/activity-logs"
          onClick={onClose}
          className="flex items-center justify-center gap-1.5 w-full text-[12px] font-medium py-2 rounded-lg transition-colors hover:bg-[#F9F9F9]"
          style={{ color: 'var(--primary)' }}
        >
          View all activity
          <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Top header bar (desktop only — sits above content area)
───────────────────────────────────────────────────────────── */
function TopBar({ user }: { user: AdminUser | null }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen]   = useState(false);
  // notification panel state
  const [notifOpen, setNotifOpen]     = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const bellRef                       = useRef<HTMLDivElement>(null);

  const PAGE_TITLES: Record<string, string> = {
    '/admin/dashboard':       'Dashboard',
    '/admin/analytics':       'Analytics',
    '/admin/users':           'Users',
    '/admin/roles':           'Roles',
    '/admin/permissions':     'Permissions',
    '/admin/pages':           'Pages',
    '/admin/notifications':   'Notifications',
    '/admin/activity-logs':   'Activity Logs',
    '/admin/settings':        'Settings',
  };

  const getTitle = () => {
    for (const [path, title] of Object.entries(PAGE_TITLES)) {
      if (pathname === path || pathname.startsWith(path + '/') || pathname.startsWith(path + '?')) {
        return title;
      }
    }
    return 'Admin';
  };

  // ⌘K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Fetch unread count on mount (and after marking read)
  const fetchUnread = useCallback(() => {
    fetch('/api/admin/notifications')
      .then((r) => r.json())
      .then((d) => setUnreadCount(d.unread_count ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchUnread();
    // Poll every 60 s so badge stays fresh
    const interval = setInterval(fetchUnread, 60_000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  const handleBellClick = () => {
    setNotifOpen((v) => !v);
  };

  return (
    <>
      <div className="hidden lg:flex h-[60px] items-center justify-between px-8 bg-white border-b border-[#E0E0E0] flex-shrink-0">
        {/* Page title */}
        <div>
          <h1 className="text-[15px] font-bold text-[#2D2D2D] leading-none">{getTitle()}</h1>
          <p className="text-[11px] text-[#757575] mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' })}
          </p>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Search pill — clickable, opens modal */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 bg-[#F9F9F9] border border-[#E0E0E0] rounded-lg px-3 py-1.5 text-[#757575] text-xs cursor-pointer hover:border-[#bdbdbd] transition-colors"
          >
            <Search size={13} />
            <span>Quick search…</span>
            <kbd className="ml-2 text-[10px] bg-white border border-[#E0E0E0] rounded px-1.5 py-0.5 text-[#757575] font-mono">⌘K</kbd>
          </button>

          {/* Notifications bell — now functional */}
          <div ref={bellRef} className="relative">
            <button
              onClick={handleBellClick}
              className="relative p-2 text-[#757575] hover:text-[#2D2D2D] rounded-lg transition-colors"
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--light-purple)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
              title="Notifications"
            >
              <Bell size={16} />
              {/* Unread badge — only shown when count > 0 */}
              {unreadCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold px-1 leading-none"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
              {/* Static dot when count is 0 but panel is closed — subtle presence indicator */}
              {unreadCount === 0 && !notifOpen && (
                <span
                  className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: 'var(--accent)', opacity: 0.4 }}
                />
              )}
            </button>

            {/* Notification dropdown */}
            {notifOpen && (
              <NotificationPanel onClose={() => setNotifOpen(false)} onAllRead={() => setUnreadCount(0)} />
            )}
          </div>

          {/* Avatar */}
          <div className="flex items-center gap-2 pl-2 border-l border-[#E0E0E0]">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold overflow-hidden"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}
            >
              {user?.avatar
                ? <img src={user.avatar} alt={user?.name} className="w-full h-full object-cover" />
                : <span>{user?.name?.[0]?.toUpperCase() ?? 'A'}</span>
              }
            </div>
            <div className="hidden xl:block">
              <p className="text-[12px] font-semibold text-[#2D2D2D] leading-none">{user?.name ?? 'Admin'}</p>
              <p className="text-[10px] text-[#757575] mt-0.5">{user?.role_name ?? 'Administrator'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search modal — rendered at top level to escape stacking context */}
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main export
───────────────────────────────────────────────────────────── */
export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loggingOut, setLoggingOut] = useState(false);
  const [site, setSite] = useState<SiteInfo>({ site_name: '', site_logo: '' });
  const didFetch = useRef(false);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;

    // Fetch auth + public site settings in parallel — no extra waterfall
    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()).catch(() => ({})),
      fetch('/api/public/settings').then((r) => r.json()).catch(() => ({ settings: {} })),
    ]).then(([authData, settingsData]) => {
      if (authData.user) setUser(authData.user);
      if (Array.isArray(authData.permissions)) setPermissions(authData.permissions);
      const s = settingsData.settings ?? {};
      setSite({ site_name: s.site_name ?? '', site_logo: s.site_logo ?? '' });
    });
  }, []);

  useEffect(() => {
    if (pathname.startsWith('/admin/settings')) setSettingsOpen(true);
  }, [pathname]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await apiFetch('/api/auth/logout', { method: 'POST' });
    toast.success('Signed out');
    router.push('/login');
  };

  const sharedProps = {
    user, permissions, pathname, settingsOpen, setSettingsOpen, loggingOut, handleLogout, site,
  };

  return (
    <>
      {/* ── Desktop sidebar ──────────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col w-[220px] border-r border-white/[0.06] fixed inset-y-0 left-0 z-30"
        style={{ backgroundColor: 'var(--sidebar-bg)' }}
      >
        <SidebarInner {...sharedProps} />
      </aside>

      {/* ── Desktop top bar (inside content area) ────────── */}
      <div className="hidden lg:block fixed top-0 left-[220px] right-0 z-20">
        <TopBar user={user} />
      </div>

      {/* ── Mobile top bar ───────────────────────────────── */}
      <div
        className="lg:hidden fixed top-0 inset-x-0 z-40 h-20 border-b border-white/[0.06] flex items-center justify-between px-4 py-4"
        style={{ backgroundColor: 'var(--sidebar-bg)' }}
      >
        <Link href="/admin/dashboard" className="flex items-center gap-2.5 py-3">
          <BrandBlock site={site} iconSize="sm" />
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 text-white/50 hover:text-white rounded-lg hover:bg-white/[0.05] transition-colors"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* ── Mobile drawer ────────────────────────────────── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="relative w-[220px] border-r border-white/[0.06] flex flex-col shadow-2xl"
            style={{ backgroundColor: 'var(--sidebar-bg)' }}
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3.5 right-3.5 p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/[0.05] transition-colors z-10"
            >
              <X size={16} />
            </button>
            <SidebarInner {...sharedProps} onNavClick={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
