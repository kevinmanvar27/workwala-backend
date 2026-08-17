'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, MapPin, CheckCircle, Star, Clock } from 'lucide-react';

interface HeroProps {
  siteName: string;
  tagline: string;
  description: string;
  playstoreCustomer: string;
  appstoreCustomer: string;
}

// Booking animation steps
const BOOKING_STEPS = [
  {
    id: 'select',
    screen: (
      <div className="space-y-2">
        <div className="text-xs font-semibold text-gray-500 mb-3">Select Service</div>
        {[
          { name: 'House Cleaning', price: '₹200/hr', emoji: '🏠', active: true },
          { name: 'Cooking',        price: '₹180/hr', emoji: '🍳', active: false },
          { name: 'Driver',         price: '₹250/hr', emoji: '🚗', active: false },
        ].map((s) => (
          <div
            key={s.name}
            className="flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: s.active ? 'color-mix(in srgb, var(--ww-green) 10%, transparent)' : '#F4F4F0',
              border: s.active ? '1.5px solid color-mix(in srgb, var(--ww-green) 30%, transparent)' : '1.5px solid transparent',
              color: s.active ? 'var(--ww-green)' : '#6B7280',
            }}
          >
            <span>{s.emoji} {s.name}</span>
            <span>{s.price}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'duration',
    screen: (
      <div className="space-y-3">
        <div className="text-xs font-semibold text-gray-500">House Cleaning · Duration</div>
        <div className="flex gap-2 flex-wrap">
          {['1 hr', '2 hrs', '3 hrs', '4 hrs'].map((d, i) => (
            <span
              key={d}
              className="px-3 py-1.5 rounded-lg text-xs font-700"
              style={{
                background: i === 1 ? 'var(--ww-green)' : '#F4F4F0',
                color: i === 1 ? '#fff' : '#6B7280',
                fontWeight: 700,
              }}
            >
              {d}
            </span>
          ))}
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1.5">
          <div className="flex justify-between"><span className="text-gray-500">Rate</span><span className="font-semibold">₹200/hr</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Duration</span><span className="font-semibold">2 hrs</span></div>
          <div className="flex justify-between font-bold text-sm pt-1 border-t border-gray-200">
            <span>Total</span><span style={{ color: 'var(--ww-green)' }}>₹400</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'finding',
    screen: (
      <div className="space-y-3 text-center py-2">
        <div
          className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-xl"
          style={{ background: 'color-mix(in srgb, var(--ww-green) 12%, transparent)' }}
        >
          📍
        </div>
        <div className="text-sm font-bold text-gray-800">Finding Partner…</div>
        <div className="text-xs text-gray-500">Searching nearby verified professionals</div>
        <div className="flex justify-center gap-1.5 pt-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{
                background: 'var(--ww-green)',
                animation: `ww-pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'found',
    screen: (
      <div className="space-y-3">
        <div
          className="rounded-xl p-3 text-center"
          style={{ background: 'color-mix(in srgb, var(--ww-green) 8%, transparent)', border: '1.5px solid color-mix(in srgb, var(--ww-green) 20%, transparent)' }}
        >
          <div className="text-lg mb-1">✅</div>
          <div className="text-sm font-bold" style={{ color: 'var(--ww-green)' }}>Partner Found!</div>
          <div className="text-xs text-gray-500 mt-0.5">Ravi K. is on the way</div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-base">👨</div>
          <div className="flex-1">
            <div className="font-semibold text-gray-800">Ravi Kumar</div>
            <div className="flex items-center gap-1 text-yellow-500">
              {'★★★★★'} <span className="text-gray-500 ml-1">4.8</span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-xs" style={{ color: 'var(--ww-green)' }}>2.4 km</div>
            <div className="text-gray-400 text-xs">~8 min</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'otp',
    screen: (
      <div className="space-y-3 text-center">
        <div className="text-xs font-semibold text-gray-500">Job Verification OTP</div>
        <div
          className="text-2xl font-black tracking-widest py-3 rounded-xl"
          style={{
            color: 'var(--ww-green)',
            background: 'color-mix(in srgb, var(--ww-green) 8%, transparent)',
            letterSpacing: '0.35em',
            fontFamily: 'monospace',
          }}
        >
          482193
        </div>
        <div className="text-xs text-gray-400">Share this with your Partner to start the job</div>
        <div
          className="text-xs font-semibold py-2 rounded-lg"
          style={{ background: 'color-mix(in srgb, var(--ww-green) 10%, transparent)', color: 'var(--ww-green)' }}
        >
          ✓ Verified · Job In Progress
        </div>
      </div>
    ),
  },
];

export default function Hero({ siteName, tagline, description, playstoreCustomer, appstoreCustomer }: HeroProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const cycle = () => {
      setVisible(false);
      timerRef.current = setTimeout(() => {
        setStepIdx((i) => (i + 1) % BOOKING_STEPS.length);
        setVisible(true);
      }, 400);
    };
    const interval = setInterval(cycle, 3200);
    return () => {
      clearInterval(interval);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const hasAppLinks = playstoreCustomer !== '#' || appstoreCustomer !== '#';

  return (
    <section className="ww-hero">
      <div className="ww-hero-bg-pattern" />
      <div className="ww-hero-grid" />

      <div className="ww-container w-full py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* ── Left: Copy ── */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold mb-6 ww-animate-fade-up"
              style={{
                background: 'rgba(255,255,255,0.10)',
                border: '1px solid rgba(255,255,255,0.18)',
                color: 'rgba(255,255,255,0.85)',
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: 'color-mix(in srgb, var(--ww-green) 80%, white)', animation: 'ww-pulse-dot 1.5s ease-in-out infinite' }}
              />
              On-demand home services
            </div>

            {/* Headline */}
            <h1 className="ww-animate-fade-up ww-delay-100 mb-6" style={{ fontSize: 'clamp(2.6rem,6vw,4.4rem)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-0.03em', color: '#fff' }}>
              Trusted help,<br />
              <span style={{ color: 'color-mix(in srgb, var(--ww-green) 70%, white)' }}>right when</span><br />
              you need it.
            </h1>

            {/* Sub */}
            <p className="ww-animate-fade-up ww-delay-200 mb-8 max-w-lg mx-auto lg:mx-0" style={{ fontSize: '1.05rem', color: 'rgba(255,255,255,0.62)', lineHeight: 1.7 }}>
              {description || `Book verified home-service professionals in minutes. ${siteName} connects you with skilled partners nearby — quickly, safely, and transparently.`}
            </p>

            {/* CTAs */}
            <div className="ww-animate-fade-up ww-delay-300 flex flex-wrap gap-3 justify-center lg:justify-start mb-10">
              <a href="#services" className="ww-btn-primary">
                Book a Service
                <ArrowRight size={16} className="ww-btn-arrow" />
              </a>
              <a href="#partners" className="ww-btn-ghost-white">
                Become a Partner
              </a>
            </div>

            {/* Trust row */}
            <div className="ww-animate-fade-up ww-delay-400 flex flex-wrap gap-x-6 gap-y-3 justify-center lg:justify-start">
              {[
                { icon: <CheckCircle size={14} />, text: 'Verified Professionals' },
                { icon: <CheckCircle size={14} />, text: 'Secure OTP Verification' },
                { icon: <MapPin size={14} />,      text: 'Live Tracking' },
                { icon: <CheckCircle size={14} />, text: 'Transparent Pricing' },
              ].map((t) => (
                <div key={t.text} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  <span style={{ color: 'color-mix(in srgb, var(--ww-green) 70%, white)' }}>{t.icon}</span>
                  {t.text}
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Phone mockup ── */}
          <div className="relative flex justify-center items-center ww-animate-scale-in ww-delay-200">
            {/* Glow */}
            <div
              className="absolute inset-0 rounded-full blur-3xl opacity-20 pointer-events-none"
              style={{ background: 'var(--ww-green)', transform: 'scale(0.7)' }}
            />

            {/* Floating chips */}
            <div className="ww-float-chip ww-animate-float" style={{ top: '10%', left: '-10px', animationDelay: '0s' }}>
              <span className="ww-float-chip-dot" style={{ background: 'var(--primary-mid, #22C55E)' }} />
              Partner Found
            </div>
            <div className="ww-float-chip ww-animate-float-slow" style={{ top: '28%', right: '-20px', animationDelay: '0.8s' }}>
              <MapPin size={12} style={{ color: 'var(--ww-green)' }} />
              2.4 km away
            </div>
            <div className="ww-float-chip ww-animate-float" style={{ bottom: '28%', left: '-15px', animationDelay: '1.2s' }}>
              <Clock size={12} style={{ color: '#F59E0B' }} />
              Arriving in 8 min
            </div>
            <div className="ww-float-chip ww-animate-float-slow" style={{ bottom: '12%', right: '-10px', animationDelay: '0.4s' }}>
              <Star size={12} style={{ color: '#F59E0B', fill: '#F59E0B' }} />
              <span>4.8 ★ Verified</span>
            </div>

            {/* Phone */}
            <div className="ww-phone">
              <div className="ww-phone-notch" />
              <div className="ww-phone-screen">
                {/* Status bar */}
                <div className="ww-phone-status-bar">
                  <span>9:41</span>
                  <span>●●●</span>
                </div>

                {/* App header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-xs text-gray-400 font-medium">Good morning</div>
                    <div className="text-sm font-bold text-gray-800">Priya Sharma 👋</div>
                  </div>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: 'var(--ww-green)' }}
                  >
                    PS
                  </div>
                </div>

                {/* Location */}
                <div
                  className="flex items-center gap-2 rounded-xl p-2.5 mb-4 text-xs"
                  style={{ background: '#F4F4F0', border: '1px solid #EBEBEB' }}
                >
                  <MapPin size={12} style={{ color: 'var(--ww-green)', flexShrink: 0 }} />
                  <span className="text-gray-600 truncate font-medium">Koramangala, Bengaluru</span>
                </div>

                {/* Animated booking step */}
                <div
                  style={{
                    transition: 'opacity 0.35s ease, transform 0.35s ease',
                    opacity: visible ? 1 : 0,
                    transform: visible ? 'translateY(0)' : 'translateY(8px)',
                  }}
                >
                  {BOOKING_STEPS[stepIdx].screen}
                </div>

                {/* Step dots */}
                <div className="flex justify-center gap-1.5 mt-4">
                  {BOOKING_STEPS.map((_, i) => (
                    <div
                      key={i}
                      className="rounded-full transition-all"
                      style={{
                        width: i === stepIdx ? 16 : 6,
                        height: 6,
                        background: i === stepIdx ? 'var(--ww-green)' : '#E5E7EB',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0 overflow-hidden leading-none" style={{ height: 60 }}>
        <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
          <path d="M0,30 C360,60 1080,0 1440,30 L1440,60 L0,60 Z" fill="#FAFAF7" />
        </svg>
      </div>
    </section>
  );
}
