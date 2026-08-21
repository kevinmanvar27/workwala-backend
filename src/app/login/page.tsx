'use client';

import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

type PublicSettings = {
  manual_login_enabled: string;
  google_login_enabled: string;
  apple_login_enabled: string;
  site_name: string;
  site_logo: string;
};

// ── Fake live activity feed ─────────────────────────────────────
const ACTIVITY = [
  { icon: '🏠', text: 'House Keeping booked',   loc: 'Sector 12, Delhi',   time: '2m ago',  color: '#22C55E' },
  { icon: '🍳', text: 'Cooking service started', loc: 'Andheri, Mumbai',    time: '5m ago',  color: '#F59E0B' },
  { icon: '🚗', text: 'Driver assigned',          loc: 'Koramangala, Blr',  time: '8m ago',  color: '#3B82F6' },
  { icon: '🚿', text: 'Bathroom cleaning done',   loc: 'Salt Lake, Kolkata', time: '11m ago', color: '#A78BFA' },
  { icon: '📦', text: 'Loading job completed',    loc: 'Powai, Mumbai',      time: '14m ago', color: '#FB923C' },
  { icon: '⭐', text: 'Partner rated 5 stars',    loc: 'CP, New Delhi',      time: '17m ago', color: '#FBBF24' },
];

// ── Fake KPI stats ──────────────────────────────────────────────
const STATS = [
  { label: 'Bookings Today', value: '47',   delta: '+12%', up: true  },
  { label: 'Revenue Today',  value: '₹9.4K', delta: '+8%',  up: true  },
  { label: 'Active Partners', value: '138',  delta: '+3',    up: true  },
  { label: 'Pending Jobs',   value: '6',    delta: '-2',    up: false },
];

// ── Mini sparkline data ─────────────────────────────────────────
const SPARKLINE = [18, 24, 19, 31, 28, 35, 29, 38, 33, 42, 39, 47];

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const w = 80, h = 28;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      <polyline
        points={`0,${h} ${pts} ${w},${h}`}
        fill={color} opacity="0.12"
        strokeWidth="0"
      />
    </svg>
  );
}

export default function LoginPage() {
  const [form, setForm]           = useState({ email: '', password: '' });
  const [loading, setLoading]     = useState(false);
  const [showPass, setShowPass]   = useState(false);
  const [actIdx, setActIdx]       = useState(0);
  const [settings, setSettings]   = useState<PublicSettings>({
    manual_login_enabled: '1',
    google_login_enabled: '0',
    apple_login_enabled:  '0',
    site_name: 'Linko',
    site_logo: '',
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch('/api/public/settings')
      .then(r => r.json())
      .then(data => {
        const s = data.settings || {};
        setSettings({
          manual_login_enabled: s.manual_login_enabled ?? '1',
          google_login_enabled: s.google_login_enabled ?? '0',
          apple_login_enabled:  s.apple_login_enabled  ?? '0',
          site_name: s.site_name ?? 'Linko',
          site_logo: s.site_logo ?? '',
        });
        setSettingsLoaded(true);
      })
      .catch(() => setSettingsLoaded(true));

    tickRef.current = setInterval(() => setActIdx(i => (i + 1) % ACTIVITY.length), 2800);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const showManual     = settings.manual_login_enabled !== '0';
  const showGoogle     = settings.google_login_enabled === '1';
  const showApple      = settings.apple_login_enabled  === '1';
  const hasSocialLogin = showGoogle || showApple;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/login', {
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
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .al-root {
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
          -webkit-font-smoothing: antialiased;
          height: 100vh;
          display: flex;
          overflow: hidden;
        }

        /* ═══════════════════════════════════════════════════════════
           LEFT PANEL
        ═══════════════════════════════════════════════════════════ */
        .al-left {
          display: none;
          width: 50%;
          position: relative;
          overflow: hidden;
          flex-direction: column;
          padding: 30px 38px;
          justify-content: center;
          background:
            linear-gradient(160deg,
              color-mix(in srgb, var(--primary, #0A8A4A) 22%, #000) 0%,
              color-mix(in srgb, var(--primary, #0A8A4A) 14%, #050A06) 45%,
              #060C07 80%,
              #040806 100%
            );
        }
        @media (min-width: 1024px) { .al-left { display: flex; } }

        /* dot grid */
        .al-dots {
          position: absolute; inset: 0; pointer-events: none;
          background-image: radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px);
          background-size: 28px 28px;
          mask-image: radial-gradient(ellipse 85% 85% at 50% 50%, black 25%, transparent 100%);
        }
        /* grid lines */
        .al-gridlines {
          position: absolute; inset: 0; pointer-events: none; opacity: 0.45;
          background-image:
            linear-gradient(rgba(var(--primary-rgb,10,138,74),0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(var(--primary-rgb,10,138,74),0.07) 1px, transparent 1px);
          background-size: 56px 56px;
        }

        /* orbs */
        @keyframes al-drift {
          0%,100% { transform: translate(0,0) scale(1); }
          33%      { transform: translate(20px,-28px) scale(1.05); }
          66%      { transform: translate(-14px,16px) scale(0.96); }
        }
        .al-orb {
          position: absolute; border-radius: 50%; pointer-events: none; filter: blur(72px);
        }
        .al-orb-1 {
          width: 520px; height: 520px; top: -160px; right: -100px;
          background: radial-gradient(circle, rgba(var(--primary-rgb,10,138,74),0.28) 0%, transparent 65%);
          animation: al-drift 11s ease-in-out infinite;
        }
        .al-orb-2 {
          width: 380px; height: 380px; bottom: -100px; left: -80px;
          background: radial-gradient(circle, rgba(245,158,11,0.16) 0%, transparent 65%);
          animation: al-drift 14s ease-in-out 3s infinite reverse;
        }
        .al-orb-3 {
          width: 240px; height: 240px; top: 38%; left: -50px;
          background: radial-gradient(circle, rgba(99,102,241,0.13) 0%, transparent 65%);
          animation: al-drift 9s ease-in-out 1.5s infinite;
        }

        /* ── KPI card ── */
        .al-kpi {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 14px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          backdrop-filter: blur(10px);
          transition: border-color 0.2s, background 0.2s;
        }
        .al-kpi:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.15);
        }

        /* ── Activity row ── */
        @keyframes al-slide-in {
          from { opacity: 0; transform: translateX(-14px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .al-activity-new { animation: al-slide-in 0.4s cubic-bezier(0.22,1,0.36,1) both; }

        /* ═══════════════════════════════════════════════════════════
           RIGHT PANEL
        ═══════════════════════════════════════════════════════════ */
        .al-right {
          width: 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          position: relative;
          overflow: hidden;
          background: #0D1110;
        }

        /* left inner content wrapper — 70% of viewport height */
        .al-left-inner {
          position: relative;
          z-index: 3;
          display: flex;
          flex-direction: column;
          height: 70vh;
          width: 100%;
          overflow: hidden;
        }

        /* right panel ambient glows */
        .al-right-orb-1 {
          position: absolute; border-radius: 50%; pointer-events: none; filter: blur(80px);
          width: 360px; height: 360px; top: -100px; right: -80px;
          background: radial-gradient(circle, rgba(var(--primary-rgb,10,138,74),0.10) 0%, transparent 65%);
        }
        .al-right-orb-2 {
          position: absolute; border-radius: 50%; pointer-events: none; filter: blur(70px);
          width: 280px; height: 280px; bottom: -80px; left: -60px;
          background: radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 65%);
        }

        /* ── Back link ── */
        .al-back {
          position: absolute; top: 24px; left: 24px;
          display: flex; align-items: center; gap: 6px;
          color: rgba(255,255,255,0.25); font-size: 0.78rem; font-weight: 600;
          text-decoration: none; font-family: inherit;
          transition: color 0.18s;
          z-index: 10;
        }
        .al-back:hover { color: rgba(255,255,255,0.65); }

        /* ── Form card entrance ── */
        @keyframes al-card-in {
          from { opacity: 0; transform: translateY(20px) scale(0.985); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .al-form-wrap {
          width: 100%; max-width: 400px;
          position: relative; z-index: 5;
          animation: al-card-in 0.5s cubic-bezier(0.22,1,0.36,1) 0.08s both;
        }

        /* ── Input ── */
        .al-input {
          width: 100%;
          background: rgba(255,255,255,0.055);
          border: 1.5px solid rgba(255,255,255,0.09);
          color: #fff;
          border-radius: 13px;
          padding: 13px 16px 13px 44px;
          font-size: 0.875rem;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
          -webkit-appearance: none;
        }
        .al-input::placeholder { color: rgba(255,255,255,0.20); }
        .al-input:focus {
          border-color: var(--primary, #0A8A4A);
          background: rgba(255,255,255,0.08);
          box-shadow: 0 0 0 3px rgba(var(--primary-rgb,10,138,74),0.16);
        }
        .al-input-wrap { position: relative; }
        .al-input-icon {
          position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          color: rgba(255,255,255,0.22); pointer-events: none; display: flex;
        }
        .al-input-pr { padding-right: 44px; }

        /* ── Eye toggle ── */
        .al-eye {
          position: absolute; right: 13px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; padding: 4px;
          color: rgba(255,255,255,0.22); display: flex;
          transition: color 0.18s;
        }
        .al-eye:hover { color: rgba(255,255,255,0.60); }

        /* ── Label ── */
        .al-label {
          display: block; font-size: 0.7rem; font-weight: 700;
          color: rgba(255,255,255,0.35); letter-spacing: 0.08em;
          text-transform: uppercase; margin-bottom: 7px;
        }

        /* ── Submit button ── */
        .al-btn {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 9px;
          background: var(--primary, #0A8A4A);
          color: #fff; font-weight: 800; font-size: 0.925rem; font-family: inherit;
          padding: 14px 24px; border-radius: 13px; border: none;
          cursor: pointer; position: relative; overflow: hidden;
          transition: background 0.2s, transform 0.18s, box-shadow 0.2s;
          box-shadow: 0 6px 28px rgba(var(--primary-rgb,10,138,74),0.42);
          letter-spacing: -0.01em;
        }
        .al-btn::before {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%);
          pointer-events: none;
        }
        .al-btn:not(:disabled):hover {
          background: var(--primary-dark, #076B38);
          transform: translateY(-2px);
          box-shadow: 0 12px 36px rgba(var(--primary-rgb,10,138,74),0.55);
        }
        .al-btn:not(:disabled):active { transform: translateY(0); }
        .al-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        /* ── Social ── */
        .al-social {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;
          font-weight: 700; font-size: 0.875rem; font-family: inherit;
          padding: 12px 20px; border-radius: 13px; cursor: pointer;
          transition: transform 0.18s, box-shadow 0.18s, opacity 0.18s;
        }
        .al-social:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,0,0,0.25); }

        /* ── Divider ── */
        .al-div { display: flex; align-items: center; gap: 12px; }
        .al-div-line { flex: 1; height: 1px; background: rgba(255,255,255,0.07); }
        .al-div-txt { color: rgba(255,255,255,0.20); font-size: 0.7rem; font-weight: 600; white-space: nowrap; }

        /* ── Spinner ── */
        @keyframes al-spin { to { transform: rotate(360deg); } }
        .al-spin { animation: al-spin 0.75s linear infinite; }

        /* ── Skeleton ── */
        @keyframes al-skel { 0%,100%{opacity:0.35} 50%{opacity:0.6} }
        .al-skel { animation: al-skel 1.4s ease-in-out infinite; }

        /* ── Pulse dot ── */
        @keyframes al-pdot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.35;transform:scale(0.7)} }
        .al-pdot { animation: al-pdot 1.8s ease-in-out infinite; }

        /* ── Glass card ── */
        .al-glass {
          background: rgba(255,255,255,0.038);
          border: 1px solid rgba(255,255,255,0.085);
          border-radius: 22px;
          padding: 30px 26px;
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07);
        }

        /* ── Logo entrance ── */
        @keyframes al-logo-in { from{opacity:0;transform:scale(0.88)} to{opacity:1;transform:scale(1)} }
        .al-logo-wrap { animation: al-logo-in 0.45s cubic-bezier(0.22,1,0.36,1) both; }
      `}</style>

      <div className="al-root">

        {/* ═══════════════════════════════════════════════════════════
            LEFT — Live Dashboard Preview
        ═══════════════════════════════════════════════════════════ */}
        <div className="al-left">
          <div className="al-dots" />
          <div className="al-gridlines" />
          <div className="al-orb al-orb-1" />
          <div className="al-orb al-orb-2" />
          <div className="al-orb al-orb-3" />

          <div className="al-left-inner">

          {/* ── Top bar: logo + live badge ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
            {/* Logo */}
            {settings.site_logo ? (
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: '#fff', borderRadius: 12, padding: '7px 16px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={settings.site_logo} alt={settings.site_name}
                  style={{ height: 32, maxWidth: 130, objectFit: 'contain', display: 'block' }} />
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'var(--primary,#0A8A4A)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(var(--primary-rgb,10,138,74),0.45)',
                  fontWeight: 900, color: '#fff', fontSize: '1rem',
                }}>
                  {settings.site_name?.charAt(0) ?? 'W'}
                </div>
                <span style={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>
                  {settings.site_name}
                </span>
              </div>
            )}

            {/* Live indicator */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'rgba(var(--primary-rgb,10,138,74),0.15)',
              border: '1px solid rgba(var(--primary-rgb,10,138,74),0.30)',
              borderRadius: 99, padding: '5px 12px',
            }}>
              <span className="al-pdot" style={{
                width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
                background: 'var(--primary-mid,#22C55E)',
                boxShadow: '0 0 8px var(--primary-mid,#22C55E)',
              }} />
              <span style={{ color: 'var(--primary-mid,#22C55E)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em' }}>
                LIVE
              </span>
            </div>
          </div>

          {/* ── Headline ── */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              Admin Dashboard
            </p>
            <h2 style={{
              fontSize: 'clamp(1.4rem, 2.2vw, 1.9rem)',
              fontWeight: 900, color: '#fff',
              lineHeight: 1.15, letterSpacing: '-0.035em',
              marginBottom: 8,
            }}>
              Your business,<br />
              <span style={{
                background: 'linear-gradient(120deg, var(--primary-mid,#4ADE80) 0%, var(--primary-light,#86EFAC) 55%, #FCD34D 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                at a glance.
              </span>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.85rem', lineHeight: 1.65, maxWidth: 360 }}>
              Real-time bookings, revenue, partners and customers — all in one place.
            </p>
          </div>

          {/* ── KPI grid ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {STATS.map((s) => (
              <div key={s.label} className="al-kpi">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {s.label}
                  </span>
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                    background: s.up ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    color: s.up ? '#4ADE80' : '#F87171',
                  }}>
                    {s.delta}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <span style={{ color: '#fff', fontWeight: 900, fontSize: '1.5rem', letterSpacing: '-0.04em', lineHeight: 1 }}>
                    {s.value}
                  </span>
                  <Sparkline data={SPARKLINE} color={s.up ? 'var(--primary-mid,#22C55E)' : '#F87171'} />
                </div>
              </div>
            ))}
          </div>

          {/* ── Live activity feed ── */}
          <div style={{
            flex: 1,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16, padding: '14px 16px',
            backdropFilter: 'blur(10px)',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                Live Activity
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span className="al-pdot" style={{
                  width: 5, height: 5, borderRadius: '50%', display: 'inline-block',
                  background: '#4ADE80',
                }} />
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.65rem', fontWeight: 600 }}>updating</span>
              </div>
            </div>

            {/* Feed rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {ACTIVITY.map((a, i) => {
                const isNew = i === actIdx;
                return (
                  <div
                    key={`${a.text}-${isNew}`}
                    className={isNew ? 'al-activity-new' : ''}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '7px 10px', borderRadius: 10,
                      background: isNew ? 'rgba(255,255,255,0.06)' : 'transparent',
                      border: isNew ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
                      transition: 'background 0.3s',
                    }}
                  >
                    {/* Icon bubble */}
                    <div style={{
                      width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                      background: `${a.color}18`,
                      border: `1px solid ${a.color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.9rem',
                    }}>
                      {a.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: isNew ? '#fff' : 'rgba(255,255,255,0.55)', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {a.text}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.68rem', marginTop: 1 }}>
                        {a.loc}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 600, color: isNew ? a.color : 'rgba(255,255,255,0.22)',
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      {a.time}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Bottom trust strip ── */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
            {['✅ Verified Partners', '📍 Live GPS', '⭐ 4.8 Rating', '🇮🇳 Made in India'].map(b => (
              <div key={b} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 99, padding: '4px 11px',
                fontSize: '0.68rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)',
              }}>
                {b}
              </div>
            ))}
          </div>

          </div>{/* end al-left-inner */}
        </div>

        {/* ═══════════════════════════════════════════════════════════
            RIGHT — Login Form
        ═══════════════════════════════════════════════════════════ */}
        <div className="al-right">
          <div className="al-right-orb-1" />
          <div className="al-right-orb-2" />

          {/* Back to site */}
          <a href="/" className="al-back">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to site
          </a>

          <div className="al-form-wrap">

            {/* ── Logo (mobile only) ── */}
            <div className="al-logo-wrap" style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
              {settings.site_logo ? (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: '#fff', borderRadius: 16, padding: '11px 26px',
                  boxShadow: '0 8px 36px rgba(0,0,0,0.50)',
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={settings.site_logo} alt={settings.site_name}
                    style={{ height: 48, maxWidth: 180, objectFit: 'contain', display: 'block' }} />
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: 18, margin: '0 auto 10px',
                    background: 'var(--primary,#0A8A4A)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 8px 28px rgba(var(--primary-rgb,10,138,74),0.50)',
                    fontSize: '1.5rem', fontWeight: 900, color: '#fff',
                  }}>
                    {settings.site_name?.charAt(0) ?? 'W'}
                  </div>
                  <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.3rem', letterSpacing: '-0.025em' }}>
                    {settings.site_name}
                  </div>
                </div>
              )}
            </div>

            {/* ── Heading ── */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <h1 style={{
                fontSize: 'clamp(1.55rem, 3.5vw, 1.9rem)',
                fontWeight: 900, color: '#fff',
                letterSpacing: '-0.035em', lineHeight: 1.15, marginBottom: 8,
              }}>
                Welcome back 👋
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem', lineHeight: 1.6 }}>
                Sign in to your admin panel
              </p>
            </div>

            {/* ── Glass card ── */}
            <div className="al-glass">

              {/* Skeleton */}
              {!settingsLoaded ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[50, 50, 50].map((h, i) => (
                    <div key={i} className="al-skel" style={{ height: h, borderRadius: 13, background: 'rgba(255,255,255,0.06)' }} />
                  ))}
                </div>
              ) : (
                <>
                  {/* Social */}
                  {hasSocialLogin && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                      {showGoogle && (
                        <button type="button" onClick={handleGoogleLogin} className="al-social"
                          style={{ background: '#fff', color: '#1a1a1a', border: 'none' }}>
                          <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, flexShrink: 0 }}>
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                          Continue with Google
                        </button>
                      )}
                      {showApple && (
                        <button type="button" onClick={handleAppleLogin} className="al-social"
                          style={{ background: '#000', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' }}>
                          <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, flexShrink: 0 }} fill="currentColor">
                            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                          </svg>
                          Continue with Apple
                        </button>
                      )}
                    </div>
                  )}

                  {/* Divider */}
                  {hasSocialLogin && showManual && (
                    <div className="al-div" style={{ marginBottom: 20 }}>
                      <div className="al-div-line" />
                      <span className="al-div-txt">or sign in with email</span>
                      <div className="al-div-line" />
                    </div>
                  )}

                  {/* Manual form */}
                  {showManual && (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                      {/* Email */}
                      <div>
                        <label className="al-label">Email address</label>
                        <div className="al-input-wrap">
                          <span className="al-input-icon">
                            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                            </svg>
                          </span>
                          <input
                            type="email" required autoComplete="email"
                            value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })}
                            placeholder="admin@linko.in"
                            className="al-input"
                          />
                        </div>
                      </div>

                      {/* Password */}
                      <div>
                        <label className="al-label">Password</label>
                        <div className="al-input-wrap">
                          <span className="al-input-icon">
                            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                            </svg>
                          </span>
                          <input
                            type={showPass ? 'text' : 'password'} required autoComplete="current-password"
                            value={form.password}
                            onChange={e => setForm({ ...form, password: e.target.value })}
                            placeholder="••••••••"
                            className={`al-input al-input-pr`}
                          />
                          <button type="button" className="al-eye" onClick={() => setShowPass(v => !v)}>
                            {showPass ? (
                              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                              </svg>
                            ) : (
                              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Submit */}
                      <button type="submit" disabled={loading} className="al-btn" style={{ marginTop: 6 }}>
                        {loading ? (
                          <>
                            <svg className="al-spin" width="16" height="16" fill="none" viewBox="0 0 24 24">
                              <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path style={{ opacity: 0.80 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                            Signing in…
                          </>
                        ) : (
                          <>
                            Enter Dashboard
                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                            </svg>
                          </>
                        )}
                      </button>
                    </form>
                  )}

                  {/* Nothing enabled */}
                  {!showManual && !hasSocialLogin && (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                      <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔒</div>
                      <p style={{ color: 'rgba(255,255,255,0.40)', fontSize: '0.875rem', marginBottom: 4 }}>Login is currently unavailable.</p>
                      <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.78rem' }}>Please contact the administrator.</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── Footer ── */}
            <p style={{
              textAlign: 'center', marginTop: 22,
              fontSize: '0.7rem', color: 'rgba(255,255,255,0.16)', lineHeight: 1.7,
            }}>
              🔒 Secured &nbsp;·&nbsp; Admin only &nbsp;·&nbsp;{' '}
              <a href="/" style={{ color: 'rgba(255,255,255,0.28)', textDecoration: 'none' }}>
                Back to homepage
              </a>
            </p>

          </div>
        </div>

      </div>
    </>
  );
}
