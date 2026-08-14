import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Edit Page',
};

export default function EditPageLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
