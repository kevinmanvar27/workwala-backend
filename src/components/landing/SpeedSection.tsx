'use client';

import { ArrowRight } from 'lucide-react';

const STEPS = [
  {
    number: '01',
    emoji: '📱',
    title: 'Open the app',
    desc: 'Launch Linko and pick exactly the service you need — in seconds.',
    color: 'var(--primary, #0A8A4A)',
    bg: '#ECFDF5',
    border: '#A7F3D0',
  },
  {
    number: '02',
    emoji: '📍',
    title: 'Set your location',
    desc: 'Confirm your address and choose how long you need the professional.',
    color: '#D97706',
    bg: '#FFFBEB',
    border: '#FDE68A',
  },
  {
    number: '03',
    emoji: '⚡',
    title: 'Get matched instantly',
    desc: 'Linko finds the nearest verified partner — average match time under 2 minutes.',
    color: '#2563EB',
    bg: '#EFF6FF',
    border: '#BFDBFE',
  },
  {
    number: '04',
    emoji: '✅',
    title: 'Job done. Pay seamlessly.',
    desc: 'OTP confirms the start, you track progress live, and pay only when complete.',
    color: '#7C3AED',
    bg: '#F5F3FF',
    border: '#DDD6FE',
  },
];

const STATS = [
  { value: '< 2 min', label: 'Match time' },
  { value: '4.8 ★',  label: 'Avg rating' },
  { value: '50K+',   label: 'Jobs done' },
  { value: '0 calls', label: 'Needed' },
];

export default function SpeedSection() {
  return (
    <section className="ww-speed-section-new">
      {/* ── Top accent line ── */}
      <div className="ww-speed-accent-line" />

      <div className="ww-container">

        {/* ── Header ── */}
        <div className="ww-speed-header ww-reveal">
          <div className="ww-label" style={{ marginBottom: 20 }}>
            <span className="ww-label-dot" />
            How It Works
          </div>

          <div className="ww-speed-headline-wrap">
            <h2 className="ww-speed-headline-new">
              No searching.<br />
              No <span className="ww-speed-highlight">endless calls.</span><br />
              <span className="ww-speed-sub-line">Just book.</span>
            </h2>

            {/* Inline stats — right side on desktop */}
            <div className="ww-speed-stats-grid ww-reveal ww-delay-200">
              {STATS.map(s => (
                <div key={s.label} className="ww-speed-stat-item">
                  <div className="ww-speed-stat-value">{s.value}</div>
                  <div className="ww-speed-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <p className="ww-speed-subtext ww-reveal ww-delay-300">
            Four steps. That&apos;s all it takes to go from &ldquo;I need help&rdquo; to &ldquo;job done.&rdquo;
          </p>
        </div>

        {/* ── Steps ── */}
        <div className="ww-speed-steps ww-stagger">
          {STEPS.map((step, i) => (
            <div
              key={step.number}
              className="ww-speed-step ww-reveal"
              style={{ transitionDelay: `${i * 0.1}s` }}
            >
              {/* Connector arrow between steps */}
              {i < STEPS.length - 1 && (
                <div className="ww-speed-connector">
                  <ArrowRight size={18} />
                </div>
              )}

              {/* Card */}
              <div
                className="ww-speed-card"
                style={{
                  '--step-color': step.color,
                  '--step-bg': step.bg,
                  '--step-border': step.border,
                } as React.CSSProperties}
              >
                {/* Step number badge */}
                <div className="ww-speed-num">{step.number}</div>

                {/* Emoji icon */}
                <div className="ww-speed-emoji-wrap" style={{ background: step.bg, border: `1.5px solid ${step.border}` }}>
                  <span className="ww-speed-emoji">{step.emoji}</span>
                </div>

                <h3 className="ww-speed-card-title">{step.title}</h3>
                <p className="ww-speed-card-desc">{step.desc}</p>

                {/* Bottom color strip */}
                <div className="ww-speed-card-strip" style={{ background: step.color }} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Bottom CTA ── */}
        <div className="ww-speed-cta ww-reveal ww-delay-400">
          <a href="#services" className="ww-btn-primary">
            Book Your First Service
            <ArrowRight size={16} className="ww-btn-arrow" />
          </a>
          <span className="ww-speed-cta-note">Free to use · No subscription · Pay per job</span>
        </div>

      </div>
    </section>
  );
}
