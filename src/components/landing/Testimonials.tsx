'use client';

import { Star } from 'lucide-react';

const TESTIMONIALS = [
  {
    name: 'Priya Sharma',
    city: 'Bengaluru',
    initials: 'PS',
    color: 'var(--primary-mid, #22C55E)',
    quote: 'Booked a house cleaning in under 2 minutes. The partner arrived on time, verified the OTP, and did an excellent job. Will definitely use again!',
    rating: 5,
  },
  {
    name: 'Arjun Mehta',
    city: 'Mumbai',
    initials: 'AM',
    color: '#3B82F6',
    quote: 'Finally a platform that actually verifies their workers. The live tracking feature gave me peace of mind. The pricing was exactly what was shown.',
    rating: 5,
  },
  {
    name: 'Kavitha Reddy',
    city: 'Hyderabad',
    initials: 'KR',
    color: '#F97316',
    quote: 'Used Linko for cooking help for a family event. The partner was professional, the OTP system was smooth, and the food was amazing!',
    rating: 5,
  },
];

export default function Testimonials() {
  return (
    <section className="ww-section" style={{ background: 'var(--ww-bg, #FAFAF7)' }}>
      <div className="ww-container">
        {/* Header */}
        <div className="text-center mb-14 ww-reveal">
          <div className="ww-label">
            <span className="ww-label-dot" />
            Testimonials
          </div>
          <h2 className="ww-h2 mb-4">
            Made for everyday life.
          </h2>
          <p className="ww-subtext max-w-xl mx-auto">
            Real experiences from people who use Linko every day.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 ww-stagger">
          {TESTIMONIALS.map((t, i) => (
            <div key={t.name} className="ww-testimonial-card ww-reveal" style={{ transitionDelay: `${i * 0.1}s` }}>
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} size={14} fill="#F59E0B" color="#F59E0B" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--ww-gray)' }}>
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: t.color }}
                >
                  {t.initials}
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: 'var(--ww-charcoal)' }}>{t.name}</div>
                  <div className="text-xs" style={{ color: 'var(--ww-gray)' }}>{t.city}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs mt-8 ww-reveal" style={{ color: 'var(--ww-gray)' }}>
          * Testimonials are placeholder content — replace with real customer reviews.
        </p>
      </div>
    </section>
  );
}
