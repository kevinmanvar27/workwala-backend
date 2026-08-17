import { query } from '@/lib/db';
import type { Metadata } from 'next';
import './landing.css';

// ── Landing components ────────────────────────────────────────
import Navbar        from '@/components/landing/Navbar';
import Hero          from '@/components/landing/Hero';
import TrustBar      from '@/components/landing/TrustBar';
import Stats         from '@/components/landing/Stats';
import Services      from '@/components/landing/Services';
import HowItWorks    from '@/components/landing/HowItWorks';
import MatchingMap   from '@/components/landing/MatchingMap';
import Safety        from '@/components/landing/Safety';
import CustomerApp   from '@/components/landing/CustomerApp';
import PartnerSection from '@/components/landing/PartnerSection';
import SpeedSection  from '@/components/landing/SpeedSection';
import Pricing       from '@/components/landing/Pricing';
import AdminPreview  from '@/components/landing/AdminPreview';
import SecurityStrip from '@/components/landing/SecurityStrip';
import Testimonials  from '@/components/landing/Testimonials';
import FinalCTA      from '@/components/landing/FinalCTA';
import Footer        from '@/components/landing/Footer';
import ScrollReveal  from '@/components/landing/ScrollReveal';

// ┅┅┅ Data fetchers ────────────────────────────────────────────────────────────

async function getSiteSettings(): Promise<Record<string, string>> {
  try {
    const rows = await query<{ key_name: string; value: string }[]>(
      `SELECT key_name, value FROM settings WHERE deleted_at IS NULL`
    );
    const cfg: Record<string, string> = {};
    rows.forEach((r) => (cfg[r.key_name] = r.value));
    return cfg;
  } catch {
    return {};
  }
}

async function getLandingStats() {
  try {
    function n(row: { count: unknown } | undefined): number {
      return Number(row?.count ?? 0);
    }
    const [totalCustomers]    = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM customers WHERE deleted_at IS NULL`);
    const [approvedPartners]  = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM partners WHERE deleted_at IS NULL AND status = 'approved'`);
    const [completedBookings] = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM bookings WHERE deleted_at IS NULL AND status = 'completed'`);
    const [totalCategories]   = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM categories WHERE deleted_at IS NULL AND is_active = 1`);
    return {
      totalCustomers:    n(totalCustomers),
      approvedPartners:  n(approvedPartners),
      completedBookings: n(completedBookings),
      totalCategories:   n(totalCategories),
    };
  } catch {
    return { totalCustomers: 0, approvedPartners: 0, completedBookings: 0, totalCategories: 0 };
  }
}

async function getActiveCategories() {
  try {
    return await query<{
      id: number;
      name: string;
      slug: string;
      description: string | null;
      price_per_hour: string;
      bg_color: string;
      border_color: string;
    }[]>(
      `SELECT id, name, slug, description, price_per_hour, bg_color, border_color
       FROM categories
       WHERE is_active = 1 AND deleted_at IS NULL
       ORDER BY sort_order ASC, id ASC
       LIMIT 10`
    );
  } catch {
    return [];
  }
}

async function getPublishedPages() {
  try {
    return await query<{ id: number; title: string; slug: string }[]>(
      `SELECT id, title, slug FROM pages WHERE deleted_at IS NULL AND status = 'published' ORDER BY title ASC LIMIT 10`
    );
  } catch {
    return [];
  }
}

// ┅┅┅ Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const siteUrl  = (settings.site_url || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  return { alternates: { canonical: siteUrl } };
}

// ┅┅┅ Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const [settings, stats, categories, pages] = await Promise.all([
    getSiteSettings(),
    getLandingStats(),
    getActiveCategories(),
    getPublishedPages(),
  ]);

  const siteName  = settings.site_name    || process.env.NEXT_PUBLIC_SITE_NAME || 'WorkWala';
  const tagline   = settings.site_tagline || 'Trusted help, right when you need it.';
  const siteLogo  = settings.site_logo?.trim() || '';
  const copyright = settings.copyright_text || `© ${new Date().getFullYear()} ${siteName}. All rights reserved.`;
  const description = settings.site_description || '';

  const playstoreCustomer = settings.playstore_customer_url?.trim() || '#';
  const appstoreCustomer  = settings.appstore_customer_url?.trim()  || '#';

  return (
    <div className="landing-root">
      {/* Scroll-triggered reveal observer */}
      <ScrollReveal />

      {/* Navigation */}
      <Navbar siteName={siteName} siteLogo={siteLogo} pages={pages} />

      {/* Hero */}
      <Hero
        siteName={siteName}
        tagline={tagline}
        description={description}
        playstoreCustomer={playstoreCustomer}
        appstoreCustomer={appstoreCustomer}
      />

      {/* Trust bar */}
      <TrustBar />

      {/* Live stats (only shown when real data exists) */}
      <Stats stats={stats} />

      {/* Services */}
      <Services categories={categories} settings={settings} />

      {/* How It Works */}
      <HowItWorks settings={settings} />

      {/* Real-time Matching Map */}
      <MatchingMap />

      {/* Safety & Trust */}
      <Safety settings={settings} />

      {/* Customer App */}
      <CustomerApp />

      {/* Partner Section */}
      <PartnerSection settings={settings} />

      {/* Speed / Simplicity */}
      <SpeedSection />

      {/* Transparent Pricing */}
      <Pricing settings={settings} />

      {/* Admin Preview */}
      <AdminPreview />

      {/* Security strip */}
      <SecurityStrip />

      {/* Testimonials */}
      <Testimonials />

      {/* Final CTA */}
      <FinalCTA settings={settings} />

      {/* Footer */}
      <Footer
        siteName={siteName}
        siteLogo={siteLogo}
        copyright={copyright}
        settings={settings}
        pages={pages}
      />
    </div>
  );
}
