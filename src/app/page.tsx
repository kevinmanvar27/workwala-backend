import Link from 'next/link';
import { query } from '@/lib/db';
import type { Metadata } from 'next';
import { ShieldCheck, Users, SlidersHorizontal } from 'lucide-react';

async function getSiteSettings() {
  try {
    const rows = await query<{ key_name: string; value: string }[]>(
      `SELECT key_name, value FROM settings WHERE group_name = 'general' AND deleted_at IS NULL`
    );
    const cfg: Record<string, string> = {};
    rows.forEach((r) => (cfg[r.key_name] = r.value));
    return cfg;
  } catch {
    return { site_name: 'BasicFlow', site_tagline: 'Build something amazing' };
  }
}

// Homepage gets its own canonical so the root layout template doesn't add " | SiteName"
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const siteUrl  = (settings.site_url || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  return {
    alternates: { canonical: siteUrl },
  };
}

export default async function HomePage() {
  const settings = await getSiteSettings();
  const siteName = settings.site_name || process.env.NEXT_PUBLIC_SITE_NAME || 'BasicFlow';
  const tagline  = settings.site_tagline || 'Build something amazing';
  const siteLogo = settings.site_logo?.trim() || '';

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, var(--sidebar-bg) 0%, var(--primary) 60%, var(--sidebar-bg) 100%)' }}>

      {/* Navbar */}
      <nav className="border-b border-white/10 backdrop-blur-sm bg-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

          {/* Logo — image if set, otherwise site name text */}
          <Link href="/" className="flex items-center flex-shrink-0">
            {siteLogo ? (
              <div className="bg-white/95 backdrop-blur-sm rounded-xl px-3 py-1.5 flex items-center justify-center shadow-sm border border-white/20">
                <img
                  src={siteLogo}
                  alt={siteName}
                  className="h-8 max-w-[148px] object-contain"
                />
              </div>
            ) : (
              <span className="text-xl font-bold text-white">{siteName}</span>
            )}
          </Link>

          <div className="flex items-center gap-4">
            <Link href="/pages" className="text-sm text-white/70 hover:text-white transition-colors">
              Pages
            </Link>
            <Link
              href="/login"
              className="text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              Admin Login
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm mb-8"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
            color: 'color-mix(in srgb, var(--accent) 80%, white)',
          }}
        >
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent)' }} />
          Welcome to {siteName}
        </div>

        {/* Headline */}
        <h1
          className="text-5xl sm:text-7xl font-bold mb-6 bg-clip-text text-transparent"
          style={{ backgroundImage: 'linear-gradient(to right, white, color-mix(in srgb, var(--light-purple) 80%, white), var(--accent))' }}
        >
          {tagline}
        </h1>

        <p className="text-xl text-white/60 max-w-2xl mx-auto mb-12">
          A professional Next.js admin panel with role-based access control, user management, and powerful settings.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="text-white font-semibold px-8 py-3 rounded-xl transition-all hover:scale-105 shadow-lg"
            style={{
              backgroundColor: 'var(--accent)',
              boxShadow: 'color-mix(in srgb, var(--accent) 25%, transparent) 0 8px 24px',
            }}
          >
            Get Started →
          </Link>
          <Link
            href="/pages"
            className="border border-white/20 hover:border-white/40 text-white font-semibold px-8 py-3 rounded-xl transition-all hover:bg-white/5"
          >
            Browse Pages
          </Link>
        </div>

        {/* Feature cards — proper icon containers replacing raw emoji stickers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-24">
          {[
            {
              icon: <ShieldCheck size={22} />,
              iconBg: 'color-mix(in srgb, var(--accent) 18%, transparent)',
              iconColor: 'color-mix(in srgb, var(--accent) 90%, white)',
              title: 'Role-Based Access',
              desc: 'Fine-grained permission control for every module',
            },
            {
              icon: <Users size={22} />,
              iconBg: 'color-mix(in srgb, var(--primary) 30%, transparent)',
              iconColor: 'color-mix(in srgb, var(--light-purple) 90%, white)',
              title: 'User Management',
              desc: 'Full CRUD with soft delete and profile uploads',
            },
            {
              icon: <SlidersHorizontal size={22} />,
              iconBg: 'rgba(255,255,255,0.08)',
              iconColor: 'rgba(255,255,255,0.85)',
              title: 'Settings Panel',
              desc: 'General, social, payment, and mail configuration',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left hover:bg-white/10 transition-colors group"
            >
              {/* Icon container — replaces raw emoji */}
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                style={{ backgroundColor: f.iconBg, color: f.iconColor }}
              >
                {f.icon}
              </div>
              <h3 className="font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-sm text-white/60">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-24 py-8 text-center text-sm text-white/40">
        <div className="flex items-center justify-center gap-6">
          <Link href="/pages/privacy-policy" className="hover:text-white/70 transition-colors">Privacy Policy</Link>
          <Link href="/pages/terms-of-service" className="hover:text-white/70 transition-colors">Terms of Service</Link>
          <Link href="/delete-account" className="hover:text-white/70 transition-colors">Delete Account</Link>
        </div>
        <p className="mt-4">© {new Date().getFullYear()} {siteName}. All rights reserved.</p>
      </footer>
    </div>
  );
}
