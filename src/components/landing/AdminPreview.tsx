'use client';

import { BarChart2, Users, CheckCircle, Bell, Tag, Shield } from 'lucide-react';

const DASHBOARD_STATS = [
  { label: 'Total Bookings',   value: '1,284', change: '+12%', color: '#3B82F6' },
  { label: 'Completed',        value: '1,091', change: '+8%',  color: 'var(--primary-mid, #22C55E)' },
  { label: 'Active Partners',  value: '47',    change: '+3',   color: '#F97316' },
  { label: 'Revenue',          value: '₹2.4L', change: '+18%', color: '#8B5CF6' },
];

const FEATURES = [
  { icon: <Users size={16} />,       label: 'Partner Management' },
  { icon: <CheckCircle size={16} />, label: 'Booking Management' },
  { icon: <BarChart2 size={16} />,   label: 'Analytics & Reports' },
  { icon: <Tag size={16} />,         label: 'Services & Pricing' },
  { icon: <Tag size={16} />,         label: 'Coupons & Offers' },
  { icon: <Bell size={16} />,        label: 'Push Notifications' },
  { icon: <Shield size={16} />,      label: 'Roles & Permissions' },
  { icon: <CheckCircle size={16} />, label: 'Activity Logs' },
];

export default function AdminPreview() {
  return (
    <section className="ww-section" style={{ background: 'var(--ww-bg-alt, #F4F4F0)' }}>
      <div className="ww-container">
        {/* Header */}
        <div className="text-center mb-14 ww-reveal">
          <div className="ww-label">
            <span className="ww-label-dot" />
            Platform
          </div>
          <h2 className="ww-h2 mb-4">
            A smarter platform<br />
            <span className="ww-green-text">behind every booking.</span>
          </h2>
          <p className="ww-subtext max-w-xl mx-auto">
            Linko isn&apos;t just an app — it&apos;s a complete service marketplace platform with a powerful admin backend.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">

          {/* Left: dashboard preview */}
          <div className="ww-reveal-left">
            <div className="ww-dashboard-preview">
              {/* Browser bar */}
              <div className="ww-dashboard-topbar">
                <div className="ww-dashboard-dot" style={{ background: '#FF5F57' }} />
                <div className="ww-dashboard-dot" style={{ background: '#FEBC2E' }} />
                <div className="ww-dashboard-dot" style={{ background: '#28C840' }} />
                <div
                  className="flex-1 mx-4 rounded-md px-3 py-1 text-xs"
                  style={{ background: '#F4F4F0', color: '#9CA3AF', maxWidth: 200 }}
                >
                  admin.linko.in
                </div>
              </div>

              {/* Dashboard content */}
              <div className="p-5">
                {/* Stat cards */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {DASHBOARD_STATS.map((s) => (
                    <div key={s.label} className="ww-dashboard-stat">
                      <div className="text-xs text-gray-400 mb-1">{s.label}</div>
                      <div className="text-xl font-extrabold" style={{ color: 'var(--ww-charcoal)', letterSpacing: '-0.02em' }}>
                        {s.value}
                      </div>
                      <div className="text-xs font-semibold mt-1" style={{ color: s.color }}>
                        {s.change} this month
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mini chart */}
                <div
                  className="rounded-xl p-4"
                  style={{ background: '#fff', border: '1px solid var(--ww-gray-border)' }}
                >
                  <div className="text-xs font-bold text-gray-700 mb-3">Booking Trends</div>
                  <div className="flex items-end gap-1.5" style={{ height: 60 }}>
                    {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 100].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-sm transition-all"
                        style={{
                          height: `${h}%`,
                          background: i === 11
                            ? 'var(--ww-green)'
                            : `color-mix(in srgb, var(--ww-green) ${30 + i * 5}%, transparent)`,
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-2">
                    <span>Jan</span><span>Jun</span><span>Aug</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: features list */}
          <div className="ww-reveal-right">
            <div className="grid grid-cols-2 gap-3 ww-stagger">
              {FEATURES.map((f, i) => (
                <div
                  key={f.label}
                  className="flex items-center gap-3 p-3 rounded-xl ww-reveal"
                  style={{
                    background: '#fff',
                    border: '1px solid var(--ww-gray-border)',
                    transitionDelay: `${i * 0.07}s`,
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: 'color-mix(in srgb, var(--ww-green) 10%, transparent)',
                      color: 'var(--ww-green)',
                    }}
                  >
                    {f.icon}
                  </div>
                  <span className="text-sm font-semibold" style={{ color: 'var(--ww-charcoal)' }}>
                    {f.label}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-8 p-5 rounded-2xl ww-reveal" style={{ background: '#fff', border: '1px solid var(--ww-gray-border)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--ww-charcoal)' }}>
                Complete operational control — from partner approvals to analytics, all in one powerful admin panel.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
