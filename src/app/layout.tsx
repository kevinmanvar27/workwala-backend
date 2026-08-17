import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
// headers() lets us read the x-nonce injected by middleware per-request
import { headers } from 'next/headers';
import './globals.css';
import ToasterProvider from '@/components/ToasterProvider';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

// ── GA script allowlist ───────────────────────────────────────────────────────
// Only inject the ga_script setting if it looks like a real Google Analytics
// or Google Tag Manager snippet.  This prevents a compromised admin account
// from injecting arbitrary JavaScript into every page.
function isSafeGaScript(script: string): boolean {
  const s = script.trim();
  if (!s) return false;
  // Must reference gtag.js or GTM — reject everything else
  return (
    s.includes('googletagmanager.com/gtag/js') ||
    s.includes('googletagmanager.com/gtm.js') ||
    s.includes('google-analytics.com/analytics.js')
  );
}

// Default brand colors — used as fallback when no DB value is set
const DEFAULTS = {
  color_primary: '#4A2372',
  color_accent:  '#C2185B',
  color_sidebar: '#2D1B45',
};

// Sanitise: only allow valid 6-digit hex colours to prevent CSS injection
function safeHex(val: string | undefined, fallback: string): string {
  if (val && /^#[0-9A-Fa-f]{6}$/.test(val.trim())) return val.trim();
  return fallback;
}

// Derive darker shade (~15% darker) for hover states
function darken(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, (n >> 16) - 38);
  const g = Math.max(0, ((n >> 8) & 0xff) - 38);
  const b = Math.max(0, (n & 0xff) - 38);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// Derive a very light tint (~92% white mix) for bg-light-purple equivalent
function tint(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) * 8 + 255 * 92) / 100);
  const g = Math.round(((((n >> 8) & 0xff) * 8) + 255 * 92) / 100);
  const b = Math.round(((n & 0xff) * 8 + 255 * 92) / 100);
  return `#${[r, g, b].map((v) => Math.min(255, v).toString(16).padStart(2, '0')).join('')}`;
}

// Extract R,G,B as comma-separated string for use in rgba()
function toRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${n >> 16},${(n >> 8) & 0xff},${n & 0xff}`;
}

// Lighten toward white by a given % (0–100)
function lighten(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.min(255, Math.round(c + (255 - c) * (pct / 100)));
  const r = mix(n >> 16);
  const g = mix((n >> 8) & 0xff);
  const b = mix(n & 0xff);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// Fetch public settings server-side on every request
async function getPublicSettings(): Promise<Record<string, string>> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/public/settings`, { cache: 'no-store' });
    if (!res.ok) return {};
    const data = await res.json();
    return data.settings ?? {};
  } catch {
    return {};
  }
}

// ── Dynamic metadata (favicon + title/og/twitter) ───────────────────────────
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSettings();

  const favicon     = settings.site_favicon?.trim() || '';
  const siteName    = settings.site_name || process.env.NEXT_PUBLIC_SITE_NAME || 'WorkWala';
  const tagline     = settings.site_tagline || '';
  const siteUrl     = (settings.site_url || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  // Derive OG locale from site_language (e.g. "en" → "en_US", "fr" → "fr_FR")
  const langCode    = settings.site_language?.trim() || 'en';
  const ogLocale    = langCode.includes('_') ? langCode : `${langCode}_${langCode.toUpperCase()}`;

  const metaTitle   = settings.meta_title
    ? settings.meta_title
    : tagline
      ? `${siteName} — ${tagline}`
      : siteName;
  const metaDesc    = settings.meta_description || tagline || '';
  const metaKw      = settings.meta_keywords || '';
  const metaAuthor  = settings.meta_author || '';
  const ogTitle     = settings.og_title || settings.meta_title || siteName;
  const ogDesc      = settings.og_description || settings.meta_description || tagline || '';
  const ogImage     = settings.meta_og_image || '';

  return {
    title: {
      default: metaTitle,
      template: `%s | ${siteName}`,
    },
    description: metaDesc || undefined,
    keywords: metaKw || undefined,
    authors: metaAuthor ? [{ name: metaAuthor }] : undefined,
    // Canonical URL — prevents duplicate content penalties
    alternates: {
      canonical: siteUrl,
    },
    icons: favicon ? { icon: favicon } : undefined,
    openGraph: {
      title: ogTitle,
      description: ogDesc || undefined,
      images: ogImage ? [ogImage] : undefined,
      url: siteUrl,
      siteName: siteName,
      type: 'website',
      locale: ogLocale,
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDesc || undefined,
      images: ogImage ? [ogImage] : undefined,
    },
    // Prevent admin/login/utility pages from being indexed (belt-and-suspenders with robots.txt)
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-snippet': -1,
        'max-image-preview': 'large',
        'max-video-preview': -1,
      },
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getPublicSettings();

  // Read the per-request nonce injected by middleware.ts.
  // This nonce is embedded in the CSP header (script-src 'nonce-<value>'),
  // so only script tags carrying this exact nonce are allowed to execute.
  // This replaces the previous 'unsafe-inline' directive.
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') ?? '';

  const gaScript  = (settings.ga_script ?? '').trim();
  const siteName  = settings.site_name || process.env.NEXT_PUBLIC_SITE_NAME || 'WorkWala';
  const tagline   = settings.site_tagline || '';
  const siteUrl   = (settings.site_url || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const ogImage   = settings.meta_og_image || '';
  const siteLang  = settings.site_language?.trim() || 'en';

  // Resolve colours — fall back to brand defaults
  const primary = safeHex(settings.color_primary, DEFAULTS.color_primary);
  const accent   = safeHex(settings.color_accent,  DEFAULTS.color_accent);
  const sidebar  = safeHex(settings.color_sidebar,  DEFAULTS.color_sidebar);

  const primaryDark  = darken(primary);
  const accentDark   = darken(accent);
  const lightTint    = tint(primary);

  // Landing-page derived tokens from the primary colour
  const primaryRgb    = toRgb(primary);
  const primaryMid    = lighten(primary, 25);   // ~25% lighter — used for mid-green
  const primaryLight  = lighten(primary, 75);   // ~75% lighter — border tints
  const primaryXlight = lighten(primary, 92);   // ~92% lighter — background fills

  const colorVars = `
    :root {
      --primary:         ${primary};
      --primary-dark:    ${primaryDark};
      --primary-rgb:     ${primaryRgb};
      --primary-mid:     ${primaryMid};
      --primary-light:   ${primaryLight};
      --primary-xlight:  ${primaryXlight};
      --accent:          ${accent};
      --accent-dark:     ${accentDark};
      --light-purple:    ${lightTint};
      --sidebar-bg:      ${sidebar};
    }
  `.trim();

  // ── WebSite + Organization JSON-LD schema (AEO) ──────────────────────────
  // Helps AI answer engines (ChatGPT, Perplexity, Google SGE) understand
  // what this site is, who runs it, and how to search it.
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    description: tagline || undefined,
    url: siteUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/pages?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteName,
    url: siteUrl,
    logo: ogImage || undefined,
    sameAs: [
      settings.social_twitter  ? `https://twitter.com/${settings.social_twitter.replace('@', '')}` : null,
      settings.social_facebook || null,
      settings.social_linkedin || null,
      settings.social_instagram || null,
    ].filter(Boolean),
  };

  return (
    <html lang={siteLang}>
      <head>
        {/* Dynamic brand colour tokens — nonce required by CSP */}
        <style nonce={nonce} dangerouslySetInnerHTML={{ __html: colorVars }} />

        {/* ── WebSite schema — AEO / structured data ── */}
        <script
          nonce={nonce}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        {/* ── Organization schema — AEO / entity recognition ── */}
        <script
          nonce={nonce}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {isSafeGaScript(gaScript) && (
          <Script
            id="google-analytics"
            nonce={nonce}
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{ __html: gaScript }}
          />
        )}
        {children}
        <ToasterProvider />
      </body>
    </html>
  );
}
