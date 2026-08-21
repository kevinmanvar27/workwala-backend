'use client';

import { Briefcase, Clock, Users, ShieldCheck, Star } from 'lucide-react';

const STEPS = [
  {
    number: '01',
    icon: <Briefcase size={26} />,
    title: 'Choose a service',
    desc: 'Pick what you need — cleaning, cooking, driving, or moving help.',
    color: 'var(--primary-mid, #22C55E)',
  },
  {
    number: '02',
    icon: <Clock size={26} />,
    title: 'Set time & location',
    desc: 'Choose how long you need the service and confirm your address.',
    color: '#3B82F6',
  },
  {
    number: '03',
    icon: <Users size={26} />,
    title: 'Get matched',
    desc: 'Linko finds the nearest available verified Partner instantly.',
    color: '#F97316',
  },
  {
    number: '04',
    icon: <ShieldCheck size={26} />,
    title: 'Meet with confidence',
    desc: 'Your Partner arrives and verifies the booking using a secure OTP.',
    color: '#8B5CF6',
  },
  {
    number: '05',
    icon: <Star size={26} />,
    title: 'Get it done',
    desc: 'Job completed, payment confirmed, and you can rate your Partner.',
    color: '#EC4899',
  },
];

export default function HowItWorks({ settings }: { settings: Record<string, string> }) {
  return (
    <section id="how-it-works" className="ww-section" style={{ background: '#fff' }}>
      <div className="ww-container">
        {/* Header */}
        <div className="text-center mb-16 ww-reveal">
          <div className="ww-label">
            <span className="ww-label-dot" />
            Simple Process
          </div>
          <h2 className="ww-h2 mb-4">
            {settings.hiw_section_title || 'From booking to doorstep\nin minutes.'}
          </h2>
          <p className="ww-subtext max-w-xl mx-auto">
            {settings.hiw_section_desc || 'Getting trusted home help has never been easier. Five simple steps.'}
          </p>
        </div>

        {/* Steps — desktop horizontal, mobile vertical */}
        <div className="hidden lg:grid grid-cols-5 gap-0 relative">
          {/* Connecting line */}
          <div
            className="absolute top-8 left-[10%] right-[10%] h-px"
            style={{
              background: 'linear-gradient(90deg, transparent, var(--ww-gray-border, #EBEBEB) 10%, var(--ww-gray-border, #EBEBEB) 90%, transparent)',
            }}
          />

          {STEPS.map((step, idx) => (
            <div key={step.number} className="relative text-center px-4 ww-reveal" style={{ transitionDelay: `${idx * 0.08}s` }}>
              {/* Icon circle */}
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 relative z-10 transition-all duration-300 group-hover:scale-110"
                style={{
                  background: `${step.color}15`,
                  color: step.color,
                  border: `1.5px solid ${step.color}30`,
                  boxShadow: `0 4px 16px ${step.color}20`,
                }}
              >
                {step.icon}
              </div>

              {/* Step number */}
              <div
                className="text-xs font-bold tracking-widest uppercase mb-2"
                style={{ color: step.color }}
              >
                Step {step.number}
              </div>

              <h3 className="ww-h3 mb-2" style={{ fontSize: '0.95rem' }}>{step.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--ww-gray)' }}>{step.desc}</p>
            </div>
          ))}
        </div>

        {/* Mobile vertical steps */}
        <div className="lg:hidden space-y-0">
          {STEPS.map((step, idx) => (
            <div key={step.number} className="flex gap-4 ww-reveal" style={{ transitionDelay: `${idx * 0.1}s` }}>
              {/* Left: icon + connector */}
              <div className="flex flex-col items-center">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: `${step.color}15`,
                    color: step.color,
                    border: `1.5px solid ${step.color}30`,
                  }}
                >
                  {step.icon}
                </div>
                {idx < STEPS.length - 1 && (
                  <div className="w-px flex-1 my-2" style={{ background: 'var(--ww-gray-border, #EBEBEB)', minHeight: 32 }} />
                )}
              </div>

              {/* Right: text */}
              <div className="pb-8 pt-1">
                <div className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: step.color }}>
                  Step {step.number}
                </div>
                <h3 className="font-bold text-base mb-1" style={{ color: 'var(--ww-charcoal)' }}>{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ww-gray)' }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Journey bar */}
        <div
          className="mt-14 rounded-2xl p-6 ww-reveal"
          style={{ background: 'color-mix(in srgb, var(--ww-green) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--ww-green) 15%, transparent)' }}
        >
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
            {['Booking Created', 'Finding Partner', 'Partner Found', 'Arriving', 'In Progress', 'Completed'].map((s, i, arr) => (
              <div key={s} className="flex items-center gap-2">
                <span
                  className="px-3 py-1.5 rounded-full"
                  style={{
                    background: i === arr.length - 1 ? 'var(--ww-green)' : 'rgba(255,255,255,0.8)',
                    color: i === arr.length - 1 ? '#fff' : 'var(--ww-charcoal)',
                    border: '1px solid var(--ww-gray-border, #EBEBEB)',
                  }}
                >
                  {s}
                </span>
                {i < arr.length - 1 && (
                  <span style={{ color: 'var(--ww-gray)' }}>→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
