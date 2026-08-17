'use client';

import { ArrowRight } from 'lucide-react';

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price_per_hour: string;
  bg_color: string;
  border_color: string;
}

interface ServicesProps {
  categories: Category[];
  settings: Record<string, string>;
}

// Service emoji map
const SERVICE_EMOJIS: Record<string, string> = {
  'house keeping':       '🏠',
  'housekeeping':        '🏠',
  'house cleaning':      '🧹',
  'bathroom cleaning':   '🚿',
  'cooking':             '🍳',
  'driver':              '🚗',
  'loading':             '📦',
  'unloading':           '📦',
  'loading / unloading': '📦',
  'gardening':           '🌿',
  'laundry':             '👕',
  'pest control':        '🐛',
  'painting':            '🎨',
  'plumbing':            '🔧',
  'electrical':          '⚡',
  'carpentry':           '🪚',
  'ac service':          '❄️',
};

function getEmoji(name: string): string {
  const key = name.toLowerCase().trim();
  for (const [k, v] of Object.entries(SERVICE_EMOJIS)) {
    if (key.includes(k)) return v;
  }
  return '✨';
}

// Fallback services when no DB categories
const FALLBACK_SERVICES = [
  { id: 1, name: 'House Keeping',       description: 'General home cleaning and tidying.',           price_per_hour: '200', bg_color: '#F0FDF4', border_color: 'var(--primary-mid, #22C55E)', slug: 'house-keeping' },
  { id: 2, name: 'Bathroom Cleaning',   description: 'Deep cleaning for bathrooms.',                 price_per_hour: '180', bg_color: '#EFF6FF', border_color: '#3B82F6', slug: 'bathroom-cleaning' },
  { id: 3, name: 'Cooking',             description: 'Home-cooked meals prepared at your home.',     price_per_hour: '200', bg_color: '#FFF7ED', border_color: '#F97316', slug: 'cooking' },
  { id: 4, name: 'Driver',              description: 'Personal driver service.',                     price_per_hour: '250', bg_color: '#F5F3FF', border_color: '#8B5CF6', slug: 'driver' },
  { id: 5, name: 'Loading / Unloading', description: 'Help moving heavy items.',                     price_per_hour: '300', bg_color: '#FFF1F2', border_color: '#F43F5E', slug: 'loading-unloading' },
];

export default function Services({ categories, settings }: ServicesProps) {
  const items = categories.length > 0 ? categories : FALLBACK_SERVICES;

  return (
    <section id="services" className="ww-section" style={{ background: 'var(--ww-bg, #FAFAF7)' }}>
      <div className="ww-container">
        {/* Header */}
        <div className="text-center mb-14 ww-reveal">
          <div className="ww-label">
            <span className="ww-label-dot" />
            Our Services
          </div>
          <h2 className="ww-h2 mb-4">
            {settings.services_section_title || (
              <>Whatever you need at home,<br />we&apos;ve got you covered.</>
            )}
          </h2>
          <p className="ww-subtext max-w-xl mx-auto">
            {settings.services_section_desc || 'Book everyday help from trusted professionals, whenever you need it.'}
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 ww-stagger">
          {items.map((cat) => {
            const price = parseFloat(cat.price_per_hour);
            const emoji = getEmoji(cat.name);
            const accentColor = cat.border_color || 'var(--ww-green)';
            const bgColor = cat.bg_color || '#F0FDF4';

            return (
              <div key={cat.id} className="ww-service-card ww-reveal group">
                {/* Icon */}
                <div
                  className="ww-service-icon-wrap"
                  style={{ background: bgColor }}
                >
                  <span style={{ fontSize: '1.6rem' }}>{emoji}</span>
                </div>

                {/* Name */}
                <h3 className="ww-h3 mb-2" style={{ fontSize: '1rem' }}>
                  {cat.name}
                </h3>

                {/* Description */}
                {cat.description && (
                  <p className="text-xs leading-relaxed mb-3 line-clamp-2" style={{ color: 'var(--ww-gray, #6B7280)' }}>
                    {cat.description}
                  </p>
                )}

                {/* Price */}
                {price > 0 && (
                  <p className="text-sm font-bold mb-1" style={{ color: accentColor }}>
                    ₹{price.toFixed(0)}
                    <span className="text-xs font-normal" style={{ color: 'var(--ww-gray)' }}>/hr</span>
                  </p>
                )}

                {/* Arrow */}
                <div className="ww-service-arrow">
                  <ArrowRight size={14} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-12 ww-reveal">
          <a href="#how-it-works" className="ww-btn-outline">
            See How It Works
            <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}
