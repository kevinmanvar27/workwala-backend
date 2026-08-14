'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';

type PublicSettings = {
  manual_login_enabled: string;
  google_login_enabled: string;
  apple_login_enabled: string;
  site_name: string;
  site_logo: string;
};

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [settings, setSettings] = useState<PublicSettings>({
    manual_login_enabled: '1',
    google_login_enabled: '0',
    apple_login_enabled: '0',
    site_name: 'BasicFlow',
    site_logo: '',
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/public/settings')
      .then((r) => r.json())
      .then((data) => {
        const s = data.settings || {};
        setSettings({
          manual_login_enabled: s.manual_login_enabled ?? '1',
          google_login_enabled: s.google_login_enabled ?? '0',
          apple_login_enabled: s.apple_login_enabled ?? '0',
          site_name: s.site_name ?? 'BasicFlow',
          site_logo: s.site_logo ?? '',
        });
        setSettingsLoaded(true);
      })
      .catch(() => setSettingsLoaded(true));
  }, []);

  const showManual = settings.manual_login_enabled !== '0';
  const showGoogle = settings.google_login_enabled === '1';
  const showApple  = settings.apple_login_enabled === '1';
  const hasSocialLogin = showGoogle || showApple;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Invalid credentials');
      } else {
        toast.success('Welcome back!');
        window.location.href = '/admin/dashboard';
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => { window.location.href = '/api/auth/google'; };
  const handleAppleLogin  = () => { window.location.href = '/api/auth/apple'; };

  return (
    // Dark page bg derived from --sidebar-bg (darkened) — keeps the moody dark feel
    <div className="min-h-screen flex" style={{ backgroundColor: 'color-mix(in srgb, var(--sidebar-bg) 80%, black)' }}>

      {/* ── Left decorative panel ── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center p-12">
        {/* Gradient uses sidebar-bg → primary → primary-dark */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, var(--sidebar-bg) 0%, var(--primary) 60%, var(--primary-dark) 100%)' }}
        />
        {/* Glow blobs */}
        <div
          className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full blur-3xl"
          style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)' }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full blur-3xl"
          style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 30%, transparent)' }}
        />

        <div className="relative z-10 max-w-sm">
          {/* Logo mark */}
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-8 shadow-lg"
            style={{ backgroundColor: 'var(--accent)', boxShadow: 'color-mix(in srgb, var(--accent) 30%, transparent) 0 8px 24px' }}
          >
            <span className="text-white font-bold text-xl">B</span>
          </div>

          <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
            Manage everything<br />from one place.
          </h2>
          <p className="text-white/50 text-sm leading-relaxed">
            Users, roles, permissions, pages, and settings — all in a clean, powerful admin panel.
          </p>

          <div className="mt-10 space-y-3">
            {['Role-based access control', 'User management with avatars', 'Configurable settings & OAuth'].map((f) => (
              <div key={f} className="flex items-center gap-3">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--accent) 20%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)',
                  }}
                >
                  <svg className="w-2.5 h-2.5" style={{ color: 'var(--accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-white/60 text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right login panel ── */}
      <div
        className="flex-1 flex items-center justify-center p-6 lg:p-12"
        style={{ backgroundColor: 'color-mix(in srgb, var(--sidebar-bg) 80%, black)' }}
      >
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="text-white font-bold">{settings.site_name}</span>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1.5">Sign in</h1>
          <p className="text-white/40 text-sm mb-8">Enter your credentials to access the admin panel</p>

          {/* Skeleton while loading */}
          {!settingsLoaded ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-11 bg-white/5 rounded-xl" />
              <div className="h-11 bg-white/5 rounded-xl" />
              <div className="h-11 bg-white/5 rounded-xl" />
            </div>
          ) : (
            <>
              {/* ── Social login buttons ── */}
              {hasSocialLogin && (
                <div className="space-y-3 mb-6">
                  {showGoogle && (
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-[#2D2D2D] font-semibold py-3 rounded-xl transition-all shadow-sm hover:shadow-md hover:-translate-y-px border border-white/10"
                    >
                      <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Continue with Google
                    </button>
                  )}

                  {showApple && (
                    <button
                      type="button"
                      onClick={handleAppleLogin}
                      className="w-full flex items-center justify-center gap-3 bg-black hover:bg-[#1a1a1a] text-white font-semibold py-3 rounded-xl transition-all shadow-sm hover:shadow-md hover:-translate-y-px border border-white/10"
                    >
                      <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" fill="currentColor">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                      </svg>
                      Continue with Apple
                    </button>
                  )}
                </div>
              )}

              {/* ── Divider ── */}
              {hasSocialLogin && showManual && (
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-white/30 text-xs font-medium">or sign in with email</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
              )}

              {/* ── Manual login form ── */}
              {showManual && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">
                      Email address
                    </label>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="admin@example.com"
                      className="w-full bg-white/5 border border-white/10 text-white placeholder-white/20 rounded-xl px-4 py-3 text-sm focus:outline-none transition-all"
                      // focus ring uses CSS var via onFocus/onBlur inline style instead of Tailwind
                      onFocus={e => { e.currentTarget.style.outline = '2px solid var(--primary)'; e.currentTarget.style.outlineOffset = '0px'; e.currentTarget.style.borderColor = 'transparent'; }}
                      onBlur={e  => { e.currentTarget.style.outline = ''; e.currentTarget.style.borderColor = ''; }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPass ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        placeholder="••••••••"
                        className="w-full bg-white/5 border border-white/10 text-white placeholder-white/20 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none transition-all"
                        onFocus={e => { e.currentTarget.style.outline = '2px solid var(--primary)'; e.currentTarget.style.outlineOffset = '0px'; e.currentTarget.style.borderColor = 'transparent'; }}
                        onBlur={e  => { e.currentTarget.style.outline = ''; e.currentTarget.style.borderColor = ''; }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors p-1"
                      >
                        {showPass ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all hover:-translate-y-px mt-2"
                    style={{ backgroundColor: 'var(--primary)', boxShadow: 'color-mix(in srgb, var(--primary) 30%, transparent) 0 8px 24px' }}
                    onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = 'var(--primary-dark)'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--primary)'; }}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Signing in…
                      </span>
                    ) : 'Sign in'}
                  </button>
                </form>
              )}

              {/* Edge case: nothing enabled */}
              {!showManual && !hasSocialLogin && (
                <div className="text-center py-8">
                  <p className="text-white/40 text-sm">Login is currently unavailable.</p>
                  <p className="text-white/25 text-xs mt-1">Please contact the administrator.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
