'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { AlertTriangle } from 'lucide-react';

export default function DeleteAccountPage() {
  const [form, setForm]           = useState({ email: '', password: '', reason: '' });
  const [loading, setLoading]     = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Site branding — fetched from public settings API
  const [siteName, setSiteName] = useState(process.env.NEXT_PUBLIC_SITE_NAME || 'WorkWala');
  const [siteLogo, setSiteLogo] = useState('');

  useEffect(() => {
    fetch('/api/public/settings')
      .then((r) => r.json())
      .then((data) => {
        const s = data.settings || {};
        if (s.site_name) setSiteName(s.site_name);
        if (s.site_logo) setSiteLogo(s.site_logo.trim());
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm('Are you sure you want to request account deletion? This action cannot be undone.')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/public/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Request failed');
      } else {
        setSubmitted(true);
        toast.success('Request submitted successfully');
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo — image if set, otherwise site name text */}
        <div className="flex items-center justify-center mb-8">
          <Link href="/">
            {siteLogo ? (
              <div className="bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl px-3 py-1.5 flex items-center justify-center">
                <img
                  src={siteLogo}
                  alt={siteName}
                  className="h-8 max-w-[150px] object-contain"
                />
              </div>
            ) : (
              <span className="font-bold text-[#2D2D2D] text-xl">{siteName}</span>
            )}
          </Link>
        </div>

        {submitted ? (
          <div className="bg-white rounded-2xl border border-[#E0E0E0] p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#2D2D2D] mb-2">Request Submitted</h2>
            <p className="text-[#757575] text-sm mb-6">
              Your account deletion request has been received. We will process it within 7 business days and notify you via email.
            </p>
            <Link href="/" className="text-sm font-medium transition-colors" style={{ color: 'var(--primary)' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--primary)')}>
              ← Back to Home
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#E0E0E0] p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#2D2D2D]">Delete Account</h1>
                <p className="text-[#757575] text-sm">This action is permanent</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-red-700">
                <strong>Warning:</strong> Deleting your account will permanently remove all your data. This cannot be undone.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#2D2D2D] mb-1.5">Email Address *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="your@email.com"
                  className="w-full border border-[#E0E0E0] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2D2D2D] mb-1.5">Password *</label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full border border-[#E0E0E0] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2D2D2D] mb-1.5">Reason (optional)</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Tell us why you're leaving..."
                  rows={3}
                  className="w-full border border-[#E0E0E0] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all"
              >
                {loading ? 'Submitting...' : 'Submit Deletion Request'}
              </button>
            </form>

            <p className="text-center text-[#757575] text-sm mt-4">
              <Link href="/" className="transition-colors text-[#757575]" onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')} onMouseLeave={e => (e.currentTarget.style.color = '')}>← Back to Home</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
