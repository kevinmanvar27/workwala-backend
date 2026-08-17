'use client';

import { ArrowRight, IndianRupee, Clock, Star, TrendingUp, ShieldCheck, Smartphone, Zap, CheckCircle } from 'lucide-react';

const PERKS = [
  { icon: <Clock size={20} />,        title: 'Work on your schedule',  desc: 'Set your availability daily. No fixed shifts, no pressure.' },
  { icon: <IndianRupee size={20} />,  title: 'Weekly bank transfers',  desc: 'Your earnings land directly in your account every week.' },
  { icon: <ShieldCheck size={20} />,  title: 'Verified & protected',   desc: 'Your profile is verified. Customers are OTP-authenticated.' },
  { icon: <TrendingUp size={20} />,   title: 'Grow with ratings',      desc: 'Top-rated partners get priority bookings and higher pay.' },
  { icon: <Smartphone size={20} />,   title: 'One simple app',         desc: 'Accept, navigate, complete, and get paid — all in one place.' },
  { icon: <Zap size={20} />,          title: 'Instant job alerts',     desc: 'Get notified the moment a customer books near you.' },
];

const ROLES = [
  { emoji: '🧹', title: 'House Cleaner',  earn: '₹22K+/mo', color: '#059652' },
  { emoji: '🍳', title: 'Cook',           earn: '₹20K+/mo', color: '#D97706' },
  { emoji: '🚗', title: 'Driver',         earn: '₹25K+/mo', color: '#2563EB' },
  { emoji: '📦', title: 'Helper',         earn: '₹18K+/mo', color: '#7C3AED' },
  { emoji: '🚿', title: 'Bathroom Pro',   earn: '₹16K+/mo', color: '#0891B2' },
];

export default function PartnerSection({ settings }: { settings: Record<string, string> }) {
  return (
    <section id="partners" className="ww-partner-new">

      {/* ════════════════════════════════════════
          LEFT PANEL — Amber/Gold warm tone
          ════════════════════════════════════════ */}
      <div className="ww-partner-left">

        {/* Background texture */}
        <div className="ww-partner-left-grid" />

        <div className="ww-partner-left-inner">

          {/* Label */}
          <div className="ww-label ww-label-dark ww-reveal" style={{ marginBottom: 24 }}>
            <span className="ww-label-dot" />
            For Partners
          </div>

          {/* Headline */}
          <h2 className="ww-partner-headline ww-reveal ww-delay-100">
            Turn your skills<br />
            into{' '}
            <span className="ww-partner-headline-accent">steady income.</span>
          </h2>

          <p className="ww-partner-subtext ww-reveal ww-delay-200">
            Join 2,400+ professionals already earning with WorkWala.
            No office. No boss. Just your craft and a phone.
          </p>

          {/* Role earning pills */}
          <div className="ww-partner-roles ww-reveal ww-delay-300">
            {ROLES.map(r => (
              <div key={r.title} className="ww-partner-role-pill" style={{ '--role-color': r.color } as React.CSSProperties}>
                <span className="ww-partner-role-emoji">{r.emoji}</span>
                <div>
                  <div className="ww-partner-role-title">{r.title}</div>
                  <div className="ww-partner-role-earn" style={{ color: r.color }}>{r.earn}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Social proof numbers */}
          <div className="ww-partner-proof ww-reveal ww-delay-400">
            {[
              { val: '2,400+', lbl: 'Active Partners' },
              { val: '4.8 ★',  lbl: 'Avg Rating' },
              { val: '₹22K',   lbl: 'Avg / Month' },
            ].map(p => (
              <div key={p.lbl} className="ww-partner-proof-item">
                <div className="ww-partner-proof-val">{p.val}</div>
                <div className="ww-partner-proof-lbl">{p.lbl}</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="ww-reveal ww-delay-500" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <a href="#" className="ww-btn-primary">
              Become a Partner
              <ArrowRight size={16} className="ww-btn-arrow" />
            </a>
            <a href="#how-it-works" className="ww-btn-ghost-white">
              Learn More
            </a>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          RIGHT PANEL — Dark, perks + mockup
          ════════════════════════════════════════ */}
      <div className="ww-partner-right">

        {/* Background orb */}
        <div className="ww-partner-right-orb" />

        <div className="ww-partner-right-inner">

          {/* Section label */}
          <div className="ww-reveal" style={{ marginBottom: 28 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 99, padding: '6px 14px',
              fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.09em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.60)',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ww-lime)', display: 'inline-block' }} />
              Why partners love WorkWala
            </div>
          </div>

          {/* Perks grid */}
          <div className="ww-partner-perks ww-stagger">
            {PERKS.map((p, i) => (
              <div
                key={p.title}
                className="ww-partner-perk ww-reveal"
                style={{ transitionDelay: `${i * 0.07}s` }}
              >
                <div className="ww-partner-perk-icon">{p.icon}</div>
                <div>
                  <div className="ww-partner-perk-title">{p.title}</div>
                  <div className="ww-partner-perk-desc">{p.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Live dashboard mini-card */}
          <div className="ww-partner-dashboard ww-reveal ww-delay-300">
            <div className="ww-partner-dashboard-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary-mid, #22C55E)', boxShadow: '0 0 8px var(--primary-mid, #22C55E)' }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.50)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Live Partner App
                </span>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.30)' }}>Today</span>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
              {[
                { label: 'Jobs', value: '4', color: 'var(--primary-mid, #22C55E)' },
                { label: 'Earned', value: '₹960', color: '#F59E0B' },
                { label: 'Rating', value: '4.9★', color: '#3B82F6' },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 10, padding: '10px 8px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '1.05rem', fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600, marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Incoming job */}
            <div style={{
              background: 'rgba(var(--primary-rgb, 10,138,74),0.12)', border: '1px solid rgba(var(--primary-rgb, 10,138,74),0.22)',
              borderRadius: 12, padding: '12px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: 'rgba(var(--primary-rgb, 10,138,74),0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
                }}>🏠</div>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>House Cleaning</div>
                  <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.40)' }}>2 hrs · 1.2 km · ₹400</div>
                </div>
              </div>
              <div style={{
                background: 'var(--ww-green)', color: '#fff',
                fontSize: '0.72rem', fontWeight: 800, padding: '6px 14px', borderRadius: 8,
                whiteSpace: 'nowrap',
              }}>Accept</div>
            </div>

            {/* Quick checklist */}
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {['Verified ID submitted', 'Bank account linked', 'Ready to go online'].map((item, i) => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: i < 2 ? 'rgba(255,255,255,0.50)' : 'var(--ww-lime)' }}>
                  <CheckCircle size={13} style={{ color: i < 2 ? 'rgba(255,255,255,0.30)' : 'var(--ww-lime)', flexShrink: 0 }} />
                  {item}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

    </section>
  );
}
