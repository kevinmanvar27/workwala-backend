'use client';

import { Users, ShieldCheck, CheckCircle, Briefcase } from 'lucide-react';

interface StatsProps {
  stats: {
    totalCustomers: number;
    approvedPartners: number;
    completedBookings: number;
    totalCategories: number;
  };
}

function formatStat(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M+`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K+`;
  if (n === 0)        return '—';
  return `${n}+`;
}

export default function Stats({ stats }: StatsProps) {
  const items = [
    { label: 'Happy Customers',    value: formatStat(stats.totalCustomers),    icon: <Users size={20} />,       color: 'var(--primary-mid, #22C55E)' },
    { label: 'Verified Partners',  value: formatStat(stats.approvedPartners),  icon: <ShieldCheck size={20} />, color: '#3B82F6' },
    { label: 'Jobs Completed',     value: formatStat(stats.completedBookings), icon: <CheckCircle size={20} />, color: '#F97316' },
    { label: 'Service Categories', value: formatStat(stats.totalCategories),   icon: <Briefcase size={20} />,   color: '#8B5CF6' },
  ];

  // Only render if we have real data
  const hasData = stats.totalCustomers > 0 || stats.approvedPartners > 0 || stats.completedBookings > 0;
  if (!hasData) return null;

  return (
    <section className="ww-section-sm" style={{ background: '#fff', borderBottom: '1px solid var(--ww-gray-border, #EBEBEB)' }}>
      <div className="ww-container">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 ww-stagger">
          {items.map((item, i) => (
            <div
              key={item.label}
              className="text-center ww-reveal"
              style={{ transitionDelay: `${i * 0.1}s` }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: `${item.color}15`, color: item.color }}
              >
                {item.icon}
              </div>
              <div className="ww-stat-value mb-1">{item.value}</div>
              <div className="text-sm" style={{ color: 'var(--ww-gray)' }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
