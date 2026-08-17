'use client';

import Link from 'next/link';
import { MapPin, Mail, Phone, ArrowRight } from 'lucide-react';

// Inline SVG social icons (lucide-react may not export these)
const IconTwitter  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.7 5.4 4.4 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>;
const IconFacebook = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>;
const IconInstagram = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>;
const IconLinkedin  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>;

interface FooterProps {
  siteName: string;
  siteLogo: string;
  copyright: string;
  settings: Record<string, string>;
  pages: { id: number; title: string; slug: string }[];
}

const SERVICES = [
  { label: 'House Keeping',       href: '#services' },
  { label: 'Bathroom Cleaning',   href: '#services' },
  { label: 'Cooking',             href: '#services' },
  { label: 'Driver',              href: '#services' },
  { label: 'Loading / Unloading', href: '#services' },
];

const COMPANY = [
  { label: 'How It Works',  href: '#how-it-works' },
  { label: 'Safety',        href: '#safety' },
  { label: 'Pricing',       href: '#pricing' },
  { label: 'Admin Panel',   href: '/login' },
];

const PARTNER = [
  { label: 'Become a Partner', href: '#partners' },
  { label: 'Partner Login',    href: '/login' },
  { label: 'Earnings Guide',   href: '#partners' },
  { label: 'Support',          href: '#' },
];

export default function Footer({ siteName, siteLogo, copyright, settings, pages }: FooterProps) {
  const socialTwitter   = settings.social_twitter?.trim()   || '';
  const socialFacebook  = settings.social_facebook?.trim()  || '';
  const socialInstagram = settings.social_instagram?.trim() || '';
  const socialLinkedin  = settings.social_linkedin?.trim()  || '';
  const contactEmail    = settings.contact_email?.trim()    || '';
  const contactPhone    = settings.contact_phone?.trim()    || '';

  const hasSocial = socialTwitter || socialFacebook || socialInstagram || socialLinkedin;

  return (
    <footer className="ww-footer" style={{ position: 'relative', overflow: 'hidden' }}>

      {/* ── Top gradient line ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg, transparent 0%, rgba(var(--primary-rgb, 10,138,74),0.5) 30%, rgba(245,158,11,0.4) 60%, transparent 100%)',
      }} />

      {/* ── Subtle background orb ── */}
      <div style={{
        position: 'absolute', width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(var(--primary-rgb, 10,138,74),0.07) 0%, transparent 65%)',
        bottom: -200, right: -100, pointerEvents: 'none',
      }} />

      {/* ── CTA Banner ── */}
      <div style={{
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '48px 0',
      }}>
        <div className="ww-container">
          <div style={{
            background: 'linear-gradient(135deg, rgba(var(--primary-rgb, 10,138,74),0.18) 0%, rgba(var(--primary-rgb, 10,138,74),0.08) 50%, rgba(245,158,11,0.08) 100%)',
            border: '1px solid rgba(var(--primary-rgb, 10,138,74),0.22)',
            borderRadius: 24,
            padding: '36px 40px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Decorative corner glow */}
            <div style={{
              position: 'absolute', top: -60, right: -60,
              width: 200, height: 200, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />

            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.025em', marginBottom: 6 }}>
                Ready to get started?
              </div>
              <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.50)', margin: 0 }}>
                Book a service or join as a partner — it takes under 2 minutes.
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, position: 'relative' }}>
              <a href="#services" className="ww-btn-primary" style={{ fontSize: '0.88rem', padding: '12px 22px' }}>
                Book a Service
                <ArrowRight size={15} className="ww-btn-arrow" />
              </a>
              <a href="#partners" className="ww-btn-ghost-white" style={{ fontSize: '0.88rem', padding: '12px 22px' }}>
                Become a Partner
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main footer grid ── */}
      <div className="ww-container" style={{ padding: '64px 28px 40px' }}>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-10 mb-14">

          {/* ── Brand column (spans 2 on lg) ── */}
          <div className="col-span-2 lg:col-span-2">
            {/* Logo / Name */}
            <div style={{ marginBottom: 18 }}>
              {siteLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={siteLogo} alt={siteName} style={{ height: 36, objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em' }}>
                  Work<span style={{ color: 'var(--ww-green)' }}>Wala</span>
                </span>
              )}
            </div>

            <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.42)', lineHeight: 1.75, marginBottom: 24, maxWidth: 280 }}>
              India&apos;s trusted on-demand home services platform. Verified professionals, transparent pricing, real-time tracking.
            </p>

            {/* Contact info */}
            {(contactEmail || contactPhone) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {contactEmail && (
                  <a href={`mailto:${contactEmail}`} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)',
                    textDecoration: 'none', transition: 'color 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--ww-lime)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
                  >
                    <Mail size={14} style={{ color: 'var(--ww-green)', flexShrink: 0 }} />
                    {contactEmail}
                  </a>
                )}
                {contactPhone && (
                  <a href={`tel:${contactPhone}`} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)',
                    textDecoration: 'none', transition: 'color 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--ww-lime)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
                  >
                    <Phone size={14} style={{ color: 'var(--ww-green)', flexShrink: 0 }} />
                    {contactPhone}
                  </a>
                )}
              </div>
            )}

            {/* Social icons */}
            {hasSocial && (
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { href: socialTwitter,   Icon: IconTwitter,   label: 'Twitter' },
                  { href: socialFacebook,  Icon: IconFacebook,  label: 'Facebook' },
                  { href: socialInstagram, Icon: IconInstagram, label: 'Instagram' },
                  { href: socialLinkedin,  Icon: IconLinkedin,  label: 'LinkedIn' },
                ].filter(s => s.href).map(({ href, Icon, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'rgba(255,255,255,0.50)',
                      transition: 'background 0.2s, color 0.2s, border-color 0.2s, transform 0.2s',
                      textDecoration: 'none',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLAnchorElement;
                      el.style.background = 'rgba(var(--primary-rgb, 10,138,74),0.20)';
                      el.style.borderColor = 'rgba(var(--primary-rgb, 10,138,74),0.35)';
                      el.style.color = 'var(--ww-lime)';
                      el.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLAnchorElement;
                      el.style.background = 'rgba(255,255,255,0.06)';
                      el.style.borderColor = 'rgba(255,255,255,0.10)';
                      el.style.color = 'rgba(255,255,255,0.50)';
                      el.style.transform = 'translateY(0)';
                    }}
                  >
                    <Icon />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* ── Services ── */}
          <div>
            <div className="ww-footer-heading">Services</div>
            {SERVICES.map(l => (
              <a key={l.label} href={l.href} className="ww-footer-link">{l.label}</a>
            ))}
          </div>

          {/* ── Company ── */}
          <div>
            <div className="ww-footer-heading">Company</div>
            {COMPANY.map(l => (
              <a key={l.label} href={l.href} className="ww-footer-link">{l.label}</a>
            ))}
            {pages.length > 0 && (
              <>
                <div className="ww-footer-heading" style={{ marginTop: 20 }}>Pages</div>
                {pages.map(p => (
                  <Link key={p.id} href={`/pages/${p.slug}`} className="ww-footer-link">{p.title}</Link>
                ))}
              </>
            )}
          </div>

          {/* ── Partners & Legal ── */}
          <div>
            <div className="ww-footer-heading">Partners</div>
            {PARTNER.map(l => (
              <a key={l.label} href={l.href} className="ww-footer-link">{l.label}</a>
            ))}

            <div className="ww-footer-heading" style={{ marginTop: 20 }}>Legal</div>
            <a href="#" className="ww-footer-link">Privacy Policy</a>
            <a href="#" className="ww-footer-link">Terms &amp; Conditions</a>
            <a href="#" className="ww-footer-link">Cancellation Policy</a>
          </div>
        </div>

        {/* ── Trust badges row ── */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 32,
          paddingBottom: 32,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          {[
            { icon: '🔒', text: 'Secure Payments' },
            { icon: '✅', text: 'Verified Partners' },
            { icon: '📍', text: 'Live GPS Tracking' },
            { icon: '⭐', text: '4.8 Avg Rating' },
            { icon: '🇮🇳', text: 'Made in India' },
          ].map(b => (
            <div key={b.text} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '6px 14px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 99,
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.40)',
            }}>
              <span>{b.icon}</span>
              {b.text}
            </div>
          ))}
        </div>

        {/* ── Bottom bar ── */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.25)' }}>{copyright}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'rgba(255,255,255,0.25)' }}>
            <MapPin size={12} style={{ color: 'var(--ww-green)' }} />
            Built with ❤️ for Indian homes
          </div>
        </div>
      </div>
    </footer>
  );
}
