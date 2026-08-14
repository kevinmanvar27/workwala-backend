import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'New Page',
};

export default function NewPageLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
