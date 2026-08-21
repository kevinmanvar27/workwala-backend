'use client';

import { useState } from 'react';
import { CheckCircle, ArrowRight } from 'lucide-react';

const DURATIONS = [
  { label: '1 hr',  hours: 1 },
  { label: '2 hrs', hours: 2 },
  { label: '3 hrs', hours: 3 },
  { label: '4 hrs', hours: 4 },
];

const SERVICES = [
  { name: 'House Cleaning',   rate: 200, emoji: '🏠' },
  { name: 'Cooking',          rate: 180, emoji: '🍳' },
  { name: 'Driver',           rate: 250, emoji: '🚗' },
  { name: 'Bathroom Cleaning',rate: 180, emoji: '🚿' },
  { name: 'Loading/Unloading',rate: 300, emoji: '📦' },
];

export default function Pricing({ settings }: { settings: Record<string, string> }) {
  const [selectedService, setSelectedService] = useState(0);
  const [selectedDuration, setSelectedDuration] = useState(1);

  const service = SERVICES[selectedService];
  const duration = DURATIONS[selectedDuration];
  const total = service.rate * duration.hours;

  return (
    <section id="pricing" className="ww-section" style={{ background: '#fff' }}>
      <div className="ww-container">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left: copy */}
          <div className="ww-reveal-left">
            <div className="ww-label">
              <span className="ww-label-dot" />
              Transparent Pricing
            </div>
            <h2 className="ww-h2 mb-5">
              {settings.pricing_title || 'Know what you\'re\npaying for.'}
            </h2>
            <p className="ww-subtext mb-8">
              {settings.pricing_desc || 'Choose the service and duration. Linko calculates the total price before you confirm your booking. No surprises.'}
            </p>

            <div className="space-y-3 mb-8">
              {[
                'Price shown before you confirm',
                'No hidden fees or surge pricing',
                'Duration-based transparent billing',
                'Instant price calculation',
              ].map((f) => (
                <div key={f} className="flex items-center gap-3 text-sm font-medium" style={{ color: 'var(--ww-charcoal)' }}>
                  <CheckCircle size={16} style={{ color: 'var(--ww-green)', flexShrink: 0 }} />
                  {f}
                </div>
              ))}
            </div>

            <a href="#services" className="ww-btn-primary">
              Book a Service
              <ArrowRight size={16} className="ww-btn-arrow" />
            </a>
          </div>

          {/* Right: interactive pricing card */}
          <div className="flex justify-center ww-reveal-right">
            <div className="ww-pricing-card">
              {/* Service selector */}
              <div className="mb-5">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Select Service</div>
                <div className="space-y-2">
                  {SERVICES.map((s, i) => (
                    <button
                      key={s.name}
                      onClick={() => setSelectedService(i)}
                      className="w-full flex items-center justify-between p-3 rounded-xl text-sm font-semibold transition-all text-left"
                      style={{
                        background: selectedService === i ? 'color-mix(in srgb, var(--ww-green) 8%, transparent)' : '#F9F9F7',
                        border: selectedService === i ? '1.5px solid color-mix(in srgb, var(--ww-green) 25%, transparent)' : '1.5px solid transparent',
                        color: selectedService === i ? 'var(--ww-green)' : 'var(--ww-gray)',
                      }}
                    >
                      <span>{s.emoji} {s.name}</span>
                      <span className="text-xs">₹{s.rate}/hr</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration selector */}
              <div className="mb-5">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Duration</div>
                <div className="flex gap-2">
                  {DURATIONS.map((d, i) => (
                    <button
                      key={d.label}
                      onClick={() => setSelectedDuration(i)}
                      className="ww-duration-btn flex-1"
                      style={{
                        background: selectedDuration === i ? 'var(--ww-green)' : 'transparent',
                        color: selectedDuration === i ? '#fff' : 'var(--ww-gray)',
                        border: selectedDuration === i ? '1.5px solid var(--ww-green)' : '1.5px solid var(--ww-gray-border)',
                      }}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price breakdown */}
              <div style={{ borderTop: '1px solid var(--ww-gray-border)', paddingTop: 16 }}>
                <div className="ww-pricing-row">
                  <span style={{ color: 'var(--ww-gray)' }}>Service</span>
                  <span className="font-semibold">{service.emoji} {service.name}</span>
                </div>
                <div className="ww-pricing-row">
                  <span style={{ color: 'var(--ww-gray)' }}>Rate</span>
                  <span className="font-semibold">₹{service.rate}/hr</span>
                </div>
                <div className="ww-pricing-row">
                  <span style={{ color: 'var(--ww-gray)' }}>Duration</span>
                  <span className="font-semibold">{duration.label}</span>
                </div>
                <div className="ww-pricing-total">
                  <span>Total</span>
                  <span
                    style={{
                      color: 'var(--ww-green)',
                      transition: 'all 0.3s ease',
                      fontSize: '1.4rem',
                    }}
                  >
                    ₹{total}
                  </span>
                </div>
              </div>

              {/* CTA */}
              <button
                className="ww-btn-primary w-full justify-center mt-5"
                style={{ borderRadius: 12 }}
              >
                Confirm Booking
                <ArrowRight size={16} className="ww-btn-arrow" />
              </button>

              <p className="text-xs text-center mt-3" style={{ color: 'var(--ww-gray)' }}>
                * Prices shown are illustrative examples
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
