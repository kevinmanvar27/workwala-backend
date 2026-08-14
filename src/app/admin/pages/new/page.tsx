'use client';
import PermissionGuard from '@/components/admin/PermissionGuard';
import PageForm from '@/components/admin/PageForm';

export default function NewPagePage() {
  return (
    <PermissionGuard permission="pages.create">
      <PageForm />
    </PermissionGuard>
  );
}
