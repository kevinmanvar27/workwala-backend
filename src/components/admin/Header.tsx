'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

const LABELS: Record<string, string> = {
  admin: 'Admin',
  dashboard: 'Dashboard',
  users: 'Users',
  roles: 'Roles',
  permissions: 'Permissions',
  pages: 'Pages',
  settings: 'Settings',
  new: 'New',
};

export default function AdminHeader({ title }: { title?: string }) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  return (
    <div className="flex items-center gap-1.5 text-sm text-[#757575] mb-6">
      <Link href="/admin/dashboard" className="hover:text-[var(--primary)] transition-colors">
        <Home size={13} />
      </Link>
      {segments.map((seg, i) => {
        const href = '/' + segments.slice(0, i + 1).join('/');
        const isLast = i === segments.length - 1;
        const label = LABELS[seg] || seg;
        return (
          <span key={href} className="flex items-center gap-1.5">
            <ChevronRight size={12} className="text-[#E0E0E0]" />
            {isLast ? (
              <span className="text-[#2D2D2D] font-medium">{label}</span>
            ) : (
              <Link href={href} className="hover:text-[var(--primary)] transition-colors">{label}</Link>
            )}
          </span>
        );
      })}
    </div>
  );
}
