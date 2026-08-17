'use client';

import { ArrowRight } from 'lucide-react';

export default function FinalCTA({ settings }: { settings: Record<string, string> }) {
  return (
    <section className="ww-final-cta ww-section">
      {/* Background blobs */}
      <div
        className="ww-final-cta-blob"
        style={{
          width: 400,
          height: 400,
          background: 'rgba(255,255,255,0.06)',
          top: '-100px',
          right: '-100px',
        }}
      />
      <div
        className="ww-final-cta-blob"
        style={{
          width: 300,
          height: 300,
          background: 'rgba(0,0,0,0.15)',
          bottom: '-80px',
          left: '-80px',
        }}
      />

      <div className="ww-container relative text-center">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold mb-6 ww-reveal"
          style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.20)', color: 'rgba(255,255,255,0.85)' }}
        >
          <span className="w-2 h-2 rounded-full bg-white" style={{ animation: 'ww-pulse-dot 1.5s ease-in-out infinite' }} />
          Available now in your city
        </div>

        {/* Headline */}
        <h2
          className="ww-reveal ww-delay-100 mb-5"
          style={{
            fontSize: 'clamp(2.2rem, 5vw, 3.8rem)',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            color: '#fff',
          }}
        >
          {settings.cta_title || 'Need a hand at home?'}
        </h2>

        <p
          className="ww-reveal ww-delay-200 mb-10 max-w-lg mx-auto"
          style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.65 }}
        >
          {settings.cta_desc || 'Book trusted help in just a few taps.'}
        </p>

        {/* CTAs */}
        <div className="ww-reveal ww-delay-300 flex flex-wrap gap-4 justify-center mb-12">
          <a
            href="#services"
            className="ww-btn-primary"
            style={{ background: '#fff', color: 'var(--ww-green)', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
          >
            Book a Service
            <ArrowRight size={16} className="ww-btn-arrow" />
          </a>
          <a href="#partners" className="ww-btn-ghost-white">
            Become a Partner
          </a>
        </div>

        {/* Illustration: simple visual */}
        <div className="ww-reveal ww-delay-400 flex items-center justify-center gap-6 text-4xl">
          <span className="ww-animate-float" style={{ animationDelay: '0s' }}>🏠</span>
          <span className="text-2xl" style={{ color: 'rgba(255,255,255,0.4)' }}>→</span>
          <span className="ww-animate-float" style={{ animationDelay: '0.5s' }}>👨‍🔧</span>
          <span className="text-2xl" style={{ color: 'rgba(255,255,255,0.4)' }}>→</span>
          <span className="ww-animate-float" style={{ animationDelay: '1s' }}>✅</span>
        </div>
      </div>
    </section>
  );
}
