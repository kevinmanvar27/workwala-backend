import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Edit User',
};

export default function EditUserLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
