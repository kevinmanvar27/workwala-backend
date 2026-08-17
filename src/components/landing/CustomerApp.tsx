'use client';

import { useState } from 'react';
import { MapPin, Clock, Star, CheckCircle, ArrowRight } from 'lucide-react';

const APP_SCREENS = [
  {
    id: 'home',
    label: 'Home',
    content: (
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-1">
          <div>
            <div className="text-xs text-gray-400">Good morning</div>
            <div className="text-sm font-bold text-gray-800">Priya Sharma 👋</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700">PS</div>
        </div>
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2.5 text-xs border border-gray-100">
          <MapPin size={11} className="text-green-600 flex-shrink-0" />
          <span className="text-gray-600 font-medium truncate">Koramangala, Bengaluru</span>
        </div>
        <div className="text-xs font-bold text-gray-700 mt-2">Popular Services</div>
        <div className="grid grid-cols-3 gap-2">
          {[['🏠','Cleaning'],['🍳','Cooking'],['🚗','Driver'],['🚿','Bathroom'],['📦','Moving'],['✨','More']].map(([e,n])=>(
            <div key={n} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-base">{e}</span>
              <span className="text-xs text-gray-600 font-medium">{n}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'select',
    label: 'Select',
    content: (
      <div className="space-y-2">
        <div className="text-xs font-bold text-gray-700 mb-2">House Cleaning</div>
        <div className="text-xs text-gray-500 mb-3">Choose duration</div>
        {[1,2,3,4].map((h)=>(
          <div
            key={h}
            className="flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold"
            style={{
              background: h===2 ? 'color-mix(in srgb, var(--ww-green) 10%, transparent)' : '#F4F4F0',
              border: h===2 ? '1.5px solid color-mix(in srgb, var(--ww-green) 25%, transparent)' : '1.5px solid transparent',
              color: h===2 ? 'var(--ww-green)' : '#6B7280',
            }}
          >
            <span>{h} hr{h>1?'s':''}</span>
            <span>₹{h*200}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'finding',
    label: 'Finding',
    content: (
      <div className="text-center py-4 space-y-3">
        <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-xl bg-green-50">📍</div>
        <div className="text-sm font-bold text-gray-800">Finding Partner…</div>
        <div className="text-xs text-gray-400">Searching nearby verified professionals</div>
        <div className="flex justify-center gap-1.5">
          {[0,1,2].map(i=>(
            <div key={i} className="w-2 h-2 rounded-full bg-green-500" style={{ animation: `ww-pulse-dot 1.2s ease-in-out ${i*0.2}s infinite` }} />
          ))}
        </div>
        <div className="text-xs text-gray-400 pt-2">3 partners nearby</div>
      </div>
    ),
  },
  {
    id: 'found',
    label: 'Matched',
    content: (
      <div className="space-y-3">
        <div className="rounded-xl p-3 text-center bg-green-50 border border-green-100">
          <div className="text-lg">✅</div>
          <div className="text-sm font-bold text-green-700">Partner Found!</div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-lg">👨</div>
          <div className="flex-1">
            <div className="text-sm font-bold text-gray-800">Ravi Kumar</div>
            <div className="flex items-center gap-1 text-xs text-yellow-500">
              <Star size={10} fill="currentColor" />
              <span className="font-semibold text-gray-700">4.8</span>
              <span className="text-gray-400">· Verified</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-green-600">2.4 km</div>
            <div className="text-xs text-gray-400 flex items-center gap-0.5"><Clock size={9}/>~8 min</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'otp',
    label: 'OTP',
    content: (
      <div className="space-y-3 text-center">
        <div className="text-xs font-semibold text-gray-500">Job Verification OTP</div>
        <div
          className="text-2xl font-black tracking-widest py-3 rounded-xl bg-green-50"
          style={{ color: 'var(--ww-green)', letterSpacing: '0.35em', fontFamily: 'monospace' }}
        >
          482193
        </div>
        <div className="text-xs text-gray-400">Share with your Partner to begin</div>
      </div>
    ),
  },
  {
    id: 'done',
    label: 'Done',
    content: (
      <div className="space-y-3 text-center">
        <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-2xl bg-green-50">🎉</div>
        <div className="text-sm font-bold text-gray-800">Job Completed!</div>
        <div className="text-xs text-gray-500">House Cleaning · 2 hrs</div>
        <div className="flex justify-center gap-1 text-yellow-400 text-lg">{'★★★★★'}</div>
        <div className="text-xs text-gray-400">Rate your experience</div>
        <div
          className="text-xs font-bold py-2 rounded-xl text-white"
          style={{ background: 'var(--ww-green)' }}
        >
          ₹400 Paid ✓
        </div>
      </div>
    ),
  },
];

export default function CustomerApp() {
  const [activeScreen, setActiveScreen] = useState(0);

  return (
    <section className="ww-section" style={{ background: 'var(--ww-bg, #FAFAF7)' }}>
      <div className="ww-container">
        <div className="grid lg:grid-cols-2 gap-12 items-center">

          {/* Left: copy */}
          <div className="ww-reveal-left order-2 lg:order-1">
            <div className="ww-label">
              <span className="ww-label-dot" />
              Customer App
            </div>
            <h2 className="ww-h2 mb-5">
              Everything you need.<br />
              <span className="ww-green-text">Right in your phone.</span>
            </h2>
            <p className="ww-subtext mb-8">
              From service selection to OTP verification and ratings — the entire experience lives in one clean, intuitive app.
            </p>

            {/* Screen selector */}
            <div className="flex flex-wrap gap-2 mb-8">
              {APP_SCREENS.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setActiveScreen(i)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: activeScreen === i ? 'var(--ww-green)' : 'var(--ww-bg-alt, #F4F4F0)',
                    color: activeScreen === i ? '#fff' : 'var(--ww-gray)',
                    border: activeScreen === i ? 'none' : '1px solid var(--ww-gray-border)',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Features list */}
            <div className="space-y-3">
              {[
                'Browse & book services in seconds',
                'Real-time partner tracking',
                'Secure OTP job verification',
                'Transparent pricing before confirmation',
                'Rate & review after every job',
              ].map((f) => (
                <div key={f} className="flex items-center gap-3 text-sm font-medium" style={{ color: 'var(--ww-charcoal)' }}>
                  <CheckCircle size={16} style={{ color: 'var(--ww-green)', flexShrink: 0 }} />
                  {f}
                </div>
              ))}
            </div>

            <div className="mt-8">
              <a href="#services" className="ww-btn-primary">
                Book a Service
                <ArrowRight size={16} className="ww-btn-arrow" />
              </a>
            </div>
          </div>

          {/* Right: phone */}
          <div className="flex justify-center order-1 lg:order-2 ww-reveal-right">
            <div className="ww-phone" style={{ width: 260, height: 520 }}>
              <div className="ww-phone-notch" />
              <div className="ww-phone-screen" style={{ padding: '48px 14px 16px' }}>
                <div className="ww-phone-status-bar">
                  <span>9:41</span>
                  <span style={{ color: 'var(--ww-green)' }}>WorkWala</span>
                  <span>●●●</span>
                </div>

                {/* Screen content with transition */}
                <div
                  key={activeScreen}
                  style={{
                    animation: 'ww-fade-up 0.35s cubic-bezier(0.22,1,0.36,1) both',
                  }}
                >
                  {APP_SCREENS[activeScreen].content}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
