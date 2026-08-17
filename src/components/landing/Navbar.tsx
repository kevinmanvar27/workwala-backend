'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, ArrowRight } from 'lucide-react';

interface NavbarProps {
  siteName: string;
  siteLogo: string;
  pages: { id: number; title: string; slug: string }[];
}

export default function Navbar({ siteName, siteLogo, pages }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { label: 'Services',     href: '#services' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'For Partners', href: '#partners' },
    { label: 'Safety',       href: '#safety' },
    { label: 'Pricing',      href: '#pricing' },
  ];

  return (
    <>
      <nav className={`ww-navbar ${scrolled ? 'ww-navbar-scrolled' : 'ww-navbar-transparent'}`}>
        <div className="ww-container w-full flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center flex-shrink-0 z-10">
            {siteLogo ? (
              <div
                className="rounded-xl px-3 py-1.5 flex items-center justify-center transition-all"
                style={{ background: scrolled ? 'transparent' : 'rgba(255,255,255,0.10)', border: scrolled ? 'none' : '1px solid rgba(255,255,255,0.15)' }}
              >
                <img src={siteLogo} alt={siteName} className="h-8 max-w-[140px] object-contain" />
              </div>
            ) : (
              <span
                className="text-xl font-extrabold tracking-tight transition-colors"
                style={{ color: scrolled ? 'var(--ww-charcoal, #1A1A1A)' : '#fff' }}
              >
                Work<span style={{ color: 'var(--ww-green)' }}>Wala</span>
              </span>
            )}
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-7">
            {navLinks.map((l) => (
              <a key={l.label} href={l.href} className="ww-nav-link">
                {l.label}
              </a>
            ))}
            {pages.length > 0 && (
              <Link href="/pages" className="ww-nav-link">Pages</Link>
            )}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-600 px-4 py-2 rounded-lg transition-all"
              style={{
                color: scrolled ? 'var(--ww-gray, #6B7280)' : 'rgba(255,255,255,0.75)',
                fontWeight: 600,
              }}
            >
              Admin Login
            </Link>
            <a
              href="#services"
              className="ww-btn-primary"
              style={{ padding: '10px 20px', fontSize: '0.875rem' }}
            >
              Book a Service
              <ArrowRight size={15} className="ww-btn-arrow" />
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl transition-colors z-10"
            style={{ background: 'rgba(255,255,255,0.10)', color: '#fff' }}
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      <div className={`ww-mobile-menu ${menuOpen ? 'open' : ''}`} aria-hidden={!menuOpen}>
        <button
          className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 text-white"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        >
          <X size={20} />
        </button>

        <div className="mb-8">
          <span className="text-2xl font-extrabold text-white tracking-tight">
            Work<span style={{ color: 'var(--ww-green)' }}>Wala</span>
          </span>
        </div>

        {navLinks.map((l) => (
          <a
            key={l.label}
            href={l.href}
            className="ww-mobile-nav-link"
            onClick={() => setMenuOpen(false)}
          >
            {l.label}
          </a>
        ))}
        {pages.length > 0 && (
          <Link href="/pages" className="ww-mobile-nav-link" onClick={() => setMenuOpen(false)}>
            Pages
          </Link>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <a href="#services" className="ww-btn-primary justify-center" onClick={() => setMenuOpen(false)}>
            Book a Service <ArrowRight size={16} />
          </a>
          <Link href="/login" className="ww-btn-ghost-white justify-center" onClick={() => setMenuOpen(false)}>
            Admin Login
          </Link>
        </div>
      </div>
    </>
  );
}
