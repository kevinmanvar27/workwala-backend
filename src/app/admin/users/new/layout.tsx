import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Add New User',
};

export default function NewUserLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
