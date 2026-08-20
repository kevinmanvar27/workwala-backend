'use client';

import DOMPurify from 'dompurify';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { apiFetch } from '@/lib/apiFetch';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';

interface PageFormProps { pageId?: number; }

export default function PageForm({ pageId }: PageFormProps) {
  const router = useRouter();
  const isEdit = !!pageId;

  const [form, setForm] = useState({
    title: '', slug: '', content: '', meta_title: '', meta_description: '', status: 'draft',
  });
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (isEdit) {
      fetch(`/api/admin/pages/${pageId}`).then((r) => r.json()).then((d) => {
        if (d.page) setForm({
          title: d.page.title, slug: d.page.slug, content: d.page.content || '',
          meta_title: d.page.meta_title || '', meta_description: d.page.meta_description || '',
          status: d.page.status,
        });
      });
    }
  }, [isEdit, pageId]);

  const autoSlug = (title: string) => title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch(isEdit ? `/api/admin/pages/${pageId}` : '/api/admin/pages', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to save page'); return; }
      toast.success(isEdit ? 'Page updated!' : 'Page created!');
      router.push('/admin/pages');
    } catch { toast.error('Something went wrong'); }
    finally { setLoading(false); }
  };

  const inputCls = "w-full bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl px-4 py-2.5 text-sm text-[#2D2D2D] placeholder-[#757575] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent focus:bg-white transition-all";
  const labelCls = "block text-xs font-semibold text-[#757575] mb-1.5 uppercase tracking-wide";

  return (
    <div className="p-6 lg:p-8 w-full">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin/pages" className="p-2 text-[#757575] hover:text-[#2D2D2D] hover:bg-[var(--light-purple)] rounded-xl transition-all">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#2D2D2D] tracking-tight">{isEdit ? 'Edit Page' : 'New Page'}</h1>
          <p className="text-[#757575] text-sm mt-0.5">Manage public page content</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-2xl border border-[#E0E0E0] p-6 shadow-sm space-y-5">
              <div>
                <label className={labelCls}>Page Title <span className="text-red-400 normal-case font-normal">*</span></label>
                <input
                  type="text" required value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value, slug: isEdit ? form.slug : autoSlug(e.target.value) })}
                  placeholder="About Us"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>URL Slug <span className="text-red-400 normal-case font-normal">*</span></label>
                <div className="flex items-center bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[var(--primary)] focus-within:border-transparent focus-within:bg-white transition-all">
                  <span className="px-3 py-2.5 text-[#757575] text-sm border-r border-[#E0E0E0] bg-[var(--light-purple)] flex-shrink-0">/pages/</span>
                  <input
                    type="text" required value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="about-us"
                    className="flex-1 px-3 py-2.5 text-sm font-mono bg-transparent focus:outline-none text-[#2D2D2D]"
                  />
                </div>
              </div>

              {/* Content editor */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelCls + ' mb-0'}>Content</label>
                  <button
                    type="button"
                    onClick={() => setPreview((v) => !v)}
                    className="flex items-center gap-1.5 text-xs text-[#757575] hover:text-[var(--primary)] transition-colors"
                  >
                    {preview ? <EyeOff size={13} /> : <Eye size={13} />}
                    {preview ? 'Edit' : 'Preview'}
                  </button>
                </div>
                {preview ? (
                  <div
                    className="min-h-[280px] bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl px-5 py-4 prose max-w-none text-sm overflow-auto"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(form.content || '<p class="text-[#757575]">Nothing to preview…</p>') }}
                  />
                ) : (
                  <textarea
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    placeholder="<h1>Page Title</h1>&#10;<p>Your content here…</p>"
                    rows={14}
                    className={`${inputCls} font-mono resize-y`}
                  />
                )}
                <p className="text-xs text-[#757575] mt-1.5">HTML is supported</p>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Publish */}
            <div className="bg-white rounded-2xl border border-[#E0E0E0] p-5 shadow-sm space-y-4">
              <p className={labelCls}>Publish</p>
              <div>
                <label className={labelCls}>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className={inputCls}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
              <button
                type="submit" disabled={loading}
                className="w-full bg-[var(--primary)] hover:bg-[var(--primary-dark)] disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-xl transition-all shadow-sm"
              >
                {loading ? 'Saving…' : isEdit ? 'Update Page' : 'Save Page'}
              </button>
              <Link
                href="/admin/pages"
                className="block text-center text-sm text-[#757575] hover:text-[#2D2D2D] transition-colors"
              >
                Cancel
              </Link>
            </div>

            {/* SEO */}
            <div className="bg-white rounded-2xl border border-[#E0E0E0] p-5 shadow-sm space-y-4">
              <p className={labelCls}>SEO</p>
              <div>
                <label className={labelCls}>Meta Title</label>
                <input
                  type="text" value={form.meta_title}
                  onChange={(e) => setForm({ ...form, meta_title: e.target.value })}
                  placeholder="Page title for search engines"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Meta Description</label>
                <textarea
                  value={form.meta_description}
                  onChange={(e) => setForm({ ...form, meta_description: e.target.value })}
                  placeholder="Brief description for search engines (150–160 chars)"
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
                <p className="text-xs text-[#757575] mt-1">{form.meta_description.length} / 160</p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
