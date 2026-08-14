import type { MetadataRoute } from 'next';
import { query } from '@/lib/db';

// Reads site_url from DB first, falls back to env — same logic as sitemap.ts
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

export default async function robots(): Promise<MetadataRoute.Robots> {
  const baseUrl = await getSiteUrl();

  return {
    rules: [
      {
        // Allow all crawlers on public pages
        userAgent: '*',
        allow: ['/', '/pages', '/pages/'],
        disallow: [
          '/admin/',
          '/api/',
          '/login',
          '/delete-account',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
