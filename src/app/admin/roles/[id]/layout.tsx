import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Edit Role',
};

export default function EditRoleLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
