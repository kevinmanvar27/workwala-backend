'use client';

import { MapPin, Clock, Star } from 'lucide-react';

export default function MatchingMap() {
  return (
    <section className="ww-section" style={{ background: 'var(--ww-bg-alt, #F4F4F0)' }}>
      <div className="ww-container">
        <div className="grid lg:grid-cols-2 gap-12 items-center">

          {/* Left: copy */}
          <div className="ww-reveal-left">
            <div className="ww-label">
              <span className="ww-label-dot" />
              Real-Time Matching
            </div>
            <h2 className="ww-h2 mb-5">
              Your help is already<br />
              <span className="ww-green-text">on the way.</span>
            </h2>
            <p className="ww-subtext mb-8">
              WorkWala instantly matches you with the nearest available verified Partner.
              No waiting, no calls — just seamless real-time connection.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              {[
                { value: '< 2 min', label: 'Average match time' },
                { value: '5 km',    label: 'Average partner distance' },
                { value: '4.8★',    label: 'Average partner rating' },
                { value: '98%',     label: 'Booking success rate' },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl p-4 ww-reveal"
                  style={{ background: '#fff', border: '1px solid var(--ww-gray-border, #EBEBEB)' }}
                >
                  <div className="text-2xl font-extrabold mb-1" style={{ color: 'var(--ww-green)', letterSpacing: '-0.02em' }}>
                    {s.value}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--ww-gray)' }}>{s.label}</div>
                </div>
              ))}
            </div>

            <a href="#services" className="ww-btn-primary">
              Book Now
              <MapPin size={16} />
            </a>
          </div>

          {/* Right: stylized map */}
          <div className="ww-reveal-right">
            <div className="ww-map-container" style={{ height: 400, padding: 24 }}>
              <div className="ww-map-grid" />

              {/* Map roads (SVG) */}
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 400 400"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ opacity: 0.15 }}
              >
                <line x1="0" y1="200" x2="400" y2="200" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
                <line x1="200" y1="0" x2="200" y2="400" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
                <line x1="0" y1="100" x2="400" y2="100" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                <line x1="0" y1="300" x2="400" y2="300" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                <line x1="100" y1="0" x2="100" y2="400" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                <line x1="300" y1="0" x2="300" y2="400" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                {/* Route line */}
                <path
                  d="M 120 280 Q 160 240 200 220 Q 240 200 260 180"
                  stroke="var(--primary-mid, #22C55E)"
                  strokeWidth="3"
                  strokeDasharray="8 4"
                  strokeLinecap="round"
                  style={{ animation: 'ww-draw-line 2s ease forwards' }}
                />
              </svg>

              {/* Customer pin */}
              <div
                className="absolute flex flex-col items-center"
                style={{ bottom: '28%', left: '25%' }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg z-10"
                  style={{ background: '#3B82F6', border: '3px solid #fff' }}
                >
                  You
                </div>
                <div
                  className="absolute inset-0 rounded-full border-2 border-blue-400 opacity-40"
                  style={{ animation: 'ww-map-pulse 2s ease-in-out infinite', transform: 'scale(1.8)' }}
                />
              </div>

              {/* Nearby partner dots */}
              {[
                { top: '20%', left: '60%', opacity: 0.4 },
                { top: '40%', left: '75%', opacity: 0.4 },
                { top: '15%', left: '35%', opacity: 0.4 },
              ].map((pos, i) => (
                <div
                  key={i}
                  className="absolute w-6 h-6 rounded-full flex items-center justify-center text-xs"
                  style={{
                    top: pos.top, left: pos.left,
                    background: 'rgba(255,255,255,0.15)',
                    border: '1.5px solid rgba(255,255,255,0.3)',
                    opacity: pos.opacity,
                  }}
                >
                  👤
                </div>
              ))}

              {/* Active partner (animated) */}
              <div
                className="absolute"
                style={{
                  top: '35%',
                  left: '55%',
                  animation: 'ww-partner-move 4s ease-in-out infinite alternate',
                }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-base shadow-lg border-2 border-white"
                  style={{ background: 'var(--ww-green)' }}
                >
                  👨
                </div>
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    border: '2px solid var(--ww-green)',
                    animation: 'ww-map-pulse 1.5s ease-in-out infinite',
                    transform: 'scale(1.6)',
                    opacity: 0.4,
                  }}
                />
              </div>

              {/* Info card */}
              <div
                className="absolute bottom-4 left-4 right-4 rounded-2xl p-4"
                style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-base"
                      style={{ background: 'color-mix(in srgb, var(--ww-green) 12%, transparent)' }}
                    >
                      👨
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-800">Ravi is on the way</div>
                      <div className="flex items-center gap-1 text-xs text-yellow-500">
                        <Star size={10} fill="currentColor" />
                        <span className="font-semibold">4.8</span>
                        <span className="text-gray-400 ml-1">Verified Partner</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold" style={{ color: 'var(--ww-green)' }}>2.4 km</div>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={10} />
                      ~8 min
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
