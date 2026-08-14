import type { MetadataRoute } from 'next';
import { query } from '@/lib/db';

async function getPublishedPages() {
  try {
    return await query<{ slug: string; created_at: string }[]>(
      `SELECT slug, created_at FROM pages WHERE deleted_at IS NULL AND status = 'published' ORDER BY created_at DESC`
    );
  } catch {
    return [];
  }
}

async function getSiteUrl(): Promise<string> {
  try {
    const rows = await query<{ value: string }[]>(
      `SELECT value FROM settings WHERE key_name = 'site_url' AND deleted_at IS NULL`
    );
    const url = rows[0]?.value?.trim();
    if (url) return url.replace(/\/$/, '');
  } catch { /* fall through */ }
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [pages, baseUrl] = await Promise.all([getPublishedPages(), getSiteUrl()]);

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/pages`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];

  const dynamicRoutes: MetadataRoute.Sitemap = pages.map((page) => ({
    url: `${baseUrl}/pages/${page.slug}`,
    lastModified: new Date(page.created_at),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...dynamicRoutes];
}
