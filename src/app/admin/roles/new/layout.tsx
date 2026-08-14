import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Role',
};

export default function NewRoleLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
