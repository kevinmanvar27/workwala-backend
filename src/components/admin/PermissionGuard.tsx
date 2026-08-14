'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldOff } from 'lucide-react';

interface PermissionGuardProps {
  permission: string;
  children: React.ReactNode;
}

/**
 * Fetches the current user's permissions from /api/auth/me and:
 * - Shows a skeleton while loading
 * - Renders children if the user has the required permission
 * - Shows a 403 "Access Denied" screen otherwise (no redirect — keeps URL intact)
 */
export default function PermissionGuard({ permission, children }: PermissionGuardProps) {
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'allowed' | 'denied'>('loading');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => {
        if (r.status === 401) { router.replace('/login'); return null; }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        const perms: string[] = Array.isArray(d.permissions) ? d.permissions : [];
        setState(perms.includes(permission) ? 'allowed' : 'denied');
      })
      .catch(() => setState('denied'));
  }, [permission, router]);

  if (state === 'loading') {
    return (
      <div className="p-6 lg:p-8 space-y-4 w-full animate-pulse">
        <div className="h-8 bg-[var(--light-purple)] rounded-xl w-48" />
        <div className="h-4 bg-[var(--light-purple)] rounded w-64" />
        <div className="h-64 bg-[var(--light-purple)] rounded-2xl mt-6" />
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <ShieldOff size={28} className="text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-[#2D2D2D] mb-2">Access Denied</h2>
          <p className="text-[#757575] text-sm leading-relaxed">
            You don&apos;t have permission to view this page.
            Contact your administrator to request access.
          </p>
          <button
            onClick={() => router.back()}
            className="mt-6 inline-flex items-center gap-2 bg-[var(--light-purple)] hover:opacity-90 text-[var(--primary)] text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
