import Link from 'next/link';
import { query } from '@/lib/db';
import { FileText, ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pages',
};

async function getPublishedPages() {
  try {
    return await query<{ id: number; title: string; slug: string; created_at: string }[]>(
      `SELECT id, title, slug, created_at FROM pages WHERE deleted_at IS NULL AND status = 'published' ORDER BY title ASC`
    );
  } catch { return []; }
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

export default async function PagesListPage() {
  const [pages, settings] = await Promise.all([getPublishedPages(), getSiteSettings()]);
  const siteName = settings.site_name || process.env.NEXT_PUBLIC_SITE_NAME || 'Linko';
  const siteLogo = settings.site_logo?.trim() || '';

  return (
    <div className="min-h-screen bg-[#F9F9F9]">
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

          <Link href="/login" className="text-sm font-medium transition-colors" style={{ color: 'var(--accent)' }}>
            Admin →
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-[#2D2D2D] mb-2">Pages</h1>
        <p className="text-[#757575] mb-8">{pages.length} published pages</p>

        {pages.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E0E0E0] p-16 text-center">
            <FileText size={40} className="mx-auto text-[#E0E0E0] mb-3" />
            <p className="text-[#757575]">No published pages yet.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {pages.map((page) => (
              <Link
                key={page.id}
                href={`/pages/${page.slug}`}
                className="bg-white rounded-2xl border border-[#E0E0E0] hover:border-[var(--primary)] hover:shadow-md transition-all group flex items-center justify-between p-6"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[var(--light-purple)] rounded-xl flex items-center justify-center">
                    <FileText size={18} className="text-[var(--primary)]" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-[#2D2D2D] group-hover:text-[var(--primary)] transition-colors">
                      {page.title}
                    </h2>
                    <p className="text-xs text-[#757575] mt-0.5">/pages/{page.slug}</p>
                  </div>
                </div>
                <ArrowRight size={18} className="text-[#E0E0E0] group-hover:text-[var(--accent)] transition-colors" />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
