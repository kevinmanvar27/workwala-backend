import type { Metadata } from 'next';
import AdminSidebar from '@/components/admin/Sidebar';

// Prevent ALL admin pages from being indexed by search engines
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <AdminSidebar />
      {/* Desktop: offset sidebar (220px) | Mobile: full width */}
      <div className="lg:pl-[220px]">
        {/* Desktop: offset top bar (60px) | Mobile: offset mobile bar (56px) */}
        <div className="pt-14 lg:pt-[60px] min-h-screen">
          {children}
        </div>
      </div>
    </div>
  );
}
