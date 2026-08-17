'use client';

import { ShieldCheck, Lock, MapPin, FileText } from 'lucide-react';

const TRUST_FEATURES = [
  {
    icon: <ShieldCheck size={24} />,
    title: 'Verified Partners',
    desc: 'Partners submit government ID, selfie, and bank information before approval. Every professional is background-checked.',
    color: 'var(--primary-mid, #22C55E)',
  },
  {
    icon: <Lock size={24} />,
    title: 'Secure OTP',
    desc: 'A unique 6-digit OTP confirms the right Partner starts the right job. No OTP, no start.',
    color: '#3B82F6',
  },
  {
    icon: <MapPin size={24} />,
    title: 'Live Tracking',
    desc: 'Customers can track their Partner in real-time while they travel to the location.',
    color: '#F97316',
  },
  {
    icon: <FileText size={24} />,
    title: 'Transparent Records',
    desc: 'Bookings, payments, ratings, and platform activity are recorded for full accountability.',
    color: '#8B5CF6',
  },
];

export default function Safety({ settings }: { settings: Record<string, string> }) {
  return (
    <section
      id="safety"
      className="ww-section"
      style={{
        background: `linear-gradient(145deg, #0D3B22 0%, color-mix(in srgb, var(--ww-green, #1A6B3C) 85%, #000) 50%, #111 100%)`,
      }}
    >
      <div className="ww-container">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left: copy */}
          <div className="ww-reveal-left">
            <div
              className="ww-label"
              style={{
                background: 'rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.80)',
              }}
            >
              <span className="ww-label-dot" style={{ background: 'rgba(255,255,255,0.6)' }} />
              Safety & Trust
            </div>
            <h2 className="ww-h2 mb-5" style={{ color: '#fff' }}>
              {settings.safety_title || 'Built around\ntrust.'}
            </h2>
            <p className="ww-subtext mb-8" style={{ color: 'rgba(255,255,255,0.60)' }}>
              {settings.safety_desc || 'Every booking is designed with safety and accountability in mind. We take trust seriously — so you can relax.'}
            </p>

            {/* Shield visual */}
            <div
              className="inline-flex items-center gap-3 rounded-2xl px-6 py-4"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ background: 'color-mix(in srgb, var(--ww-green) 20%, transparent)' }}
              >
                🛡️
              </div>
              <div>
                <div className="text-white font-bold text-sm">100% Accountability</div>
                <div className="text-xs" style={{ color: 'rgba(255,255,255,0.50)' }}>Every booking has a verifiable trail</div>
              </div>
            </div>
          </div>

          {/* Right: feature cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 ww-stagger">
            {TRUST_FEATURES.map((feat, i) => (
              <div key={feat.title} className="ww-safety-card ww-reveal" style={{ transitionDelay: `${i * 0.1}s` }}>
                <div
                  className="ww-safety-icon"
                  style={{
                    background: `${feat.color}20`,
                    color: feat.color,
                  }}
                >
                  {feat.icon}
                </div>
                <h3 className="font-bold text-white text-base mb-2">{feat.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
