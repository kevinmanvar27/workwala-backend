import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Activity Logs',
};

export default function ActivityLogsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
