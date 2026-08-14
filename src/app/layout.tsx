import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Toaster } from 'react-hot-toast';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

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
  const siteName    = settings.site_name || process.env.NEXT_PUBLIC_SITE_NAME || 'BasicFlow';
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

  const gaScript  = (settings.ga_script ?? '').trim();
  const siteName  = settings.site_name || process.env.NEXT_PUBLIC_SITE_NAME || 'BasicFlow';
  const tagline   = settings.site_tagline || '';
  const siteUrl   = (settings.site_url || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const ogImage   = settings.meta_og_image || '';
  const siteLang  = settings.site_language?.trim() || 'en';

  // Resolve colours — fall back to brand defaults
  const primary = safeHex(settings.color_primary, DEFAULTS.color_primary);
  const accent   = safeHex(settings.color_accent,  DEFAULTS.color_accent);
  const sidebar  = safeHex(settings.color_sidebar,  DEFAULTS.color_sidebar);

  const primaryDark = darken(primary);
  const accentDark  = darken(accent);
  const lightTint   = tint(primary);

  const colorVars = `
    :root {
      --primary:      ${primary};
      --primary-dark: ${primaryDark};
      --accent:       ${accent};
      --accent-dark:  ${accentDark};
      --light-purple: ${lightTint};
      --sidebar-bg:   ${sidebar};
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
        {/* Dynamic brand colour tokens */}
        <style dangerouslySetInnerHTML={{ __html: colorVars }} />

        {/* ── WebSite schema — AEO / structured data ── */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        {/* ── Organization schema — AEO / entity recognition ── */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {gaScript && (
          <Script
            id="google-analytics"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{ __html: gaScript }}
          />
        )}
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
