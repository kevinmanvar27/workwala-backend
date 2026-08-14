import { notFound } from 'next/navigation';
import Link from 'next/link';
import { query } from '@/lib/db';
import type { Metadata } from 'next';

type Props = { params: Promise<{ slug: string }> };

async function getPage(slug: string) {
  try {
    const pages = await query<{
      id: number; title: string; slug: string; content: string;
      meta_title: string; meta_description: string; created_at: string; updated_at: string;
    }[]>(
      `SELECT id, title, slug, content, meta_title, meta_description, created_at,
              COALESCE(updated_at, created_at) AS updated_at
       FROM pages WHERE slug = ? AND deleted_at IS NULL AND status = 'published'`,
      [slug]
    );
    return pages[0] || null;
  } catch { return null; }
}

async function getSiteSettings() {
  try {
    const rows = await query<{ key_name: string; value: string }[]>(
      `SELECT key_name, value FROM settings WHERE group_name = 'general' AND deleted_at IS NULL`
    );
    const cfg: Record<string, string> = {};
    rows.forEach((r) => (cfg[r.key_name] = r.value));
    return cfg;
  } catch { return {}; }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [page, settings] = await Promise.all([getPage(slug), getSiteSettings()]);

  if (!page) return { title: 'Page Not Found' };

  const siteName = settings.site_name || process.env.NEXT_PUBLIC_SITE_NAME || 'BasicFlow';
  const siteUrl  = (settings.site_url || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const pageUrl  = `${siteUrl}/pages/${page.slug}`;
  const ogImage  = settings.meta_og_image || '';

  return {
    title: page.meta_title || page.title,
    description: page.meta_description || undefined,
    // Canonical prevents duplicate-content issues if the page is linked from multiple paths
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: page.meta_title || page.title,
      description: page.meta_description || undefined,
      url: pageUrl,
      siteName,
      // article type tells crawlers & AI this is a content page, not a homepage
      type: 'article',
      publishedTime: new Date(page.created_at).toISOString(),
      modifiedTime: new Date(page.updated_at).toISOString(),
      images: ogImage ? [ogImage] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: page.meta_title || page.title,
      description: page.meta_description || undefined,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function PublicPageDetail({ params }: Props) {
  const { slug } = await params;
  const [page, settings] = await Promise.all([getPage(slug), getSiteSettings()]);

  if (!page) notFound();

  const siteName = settings.site_name || process.env.NEXT_PUBLIC_SITE_NAME || 'BasicFlow';
  const siteLogo = settings.site_logo?.trim() || '';
  const siteUrl  = (settings.site_url || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const pageUrl  = `${siteUrl}/pages/${page.slug}`;
  const ogImage  = settings.meta_og_image || '';

  // ── Article JSON-LD schema (AEO) ─────────────────────────────────────────
  // Tells AI answer engines the exact content, author, and dates of this page
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: page.meta_title || page.title,
    description: page.meta_description || undefined,
    url: pageUrl,
    datePublished: new Date(page.created_at).toISOString(),
    dateModified: new Date(page.updated_at).toISOString(),
    publisher: {
      '@type': 'Organization',
      name: siteName,
      url: siteUrl,
      logo: ogImage ? { '@type': 'ImageObject', url: ogImage } : undefined,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': pageUrl,
    },
  };

  // ── BreadcrumbList JSON-LD schema (AEO) ──────────────────────────────────
  // Gives crawlers & AI the navigation path: Home > Pages > This Page
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',  item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Pages', item: `${siteUrl}/pages` },
      { '@type': 'ListItem', position: 3, name: page.title, item: pageUrl },
    ],
  };

  return (
    <div className="min-h-screen bg-[#F9F9F9]">
      {/* Structured data — injected in <head> by Next.js */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Nav */}
      <nav className="bg-white border-b border-[#E0E0E0]">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo — image if set, otherwise site name text */}
          <Link href="/" className="flex items-center flex-shrink-0">
            {siteLogo ? (
              <div className="bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl px-3 py-1.5 flex items-center justify-center">
                <img
                  src={siteLogo}
                  alt={siteName}
                  className="h-7 max-w-[130px] object-contain"
                />
              </div>
            ) : (
              <span className="font-bold text-[#2D2D2D] text-lg">{siteName}</span>
            )}
          </Link>
          <Link href="/pages" className="text-sm text-[#757575] hover:text-[var(--primary)] transition-colors">← All Pages</Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl border border-[#E0E0E0] p-8 lg:p-12">
          <div className="mb-8 pb-6 border-b border-[#E0E0E0]">
            <h1 className="text-3xl font-bold text-[#2D2D2D]">{page.title}</h1>
            <p className="text-[#757575] text-sm mt-2">
              Last updated {new Date(page.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div
            className="prose max-w-none text-[#2D2D2D]"
            dangerouslySetInnerHTML={{ __html: page.content || '' }}
          />
        </div>
      </main>
    </div>
  );
}
