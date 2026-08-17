'use client';

import { CheckCircle } from 'lucide-react';

const SECURITY_ITEMS = [
  'OTP Login',
  'Partner Verification',
  'Job OTP',
  'GPS Matching',
  'Role-Based Access',
  'Activity Logs',
];

export default function SecurityStrip() {
  return (
    <section className="ww-dark-strip py-16">
      <div className="ww-container">
        <div className="text-center mb-10 ww-reveal">
          <h2
            className="text-2xl sm:text-3xl font-extrabold text-white mb-3"
            style={{ letterSpacing: '-0.02em' }}
          >
            Every booking has a trail.
          </h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            End-to-end accountability built into every interaction.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3 ww-stagger">
          {SECURITY_ITEMS.map((item, i) => (
            <div
              key={item}
              className="ww-dark-strip-item ww-reveal px-4 py-2.5 rounded-xl"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                transitionDelay: `${i * 0.08}s`,
              }}
            >
              <span className="ww-dark-strip-check">
                <CheckCircle size={13} />
              </span>
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
