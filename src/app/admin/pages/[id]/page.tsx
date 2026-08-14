'use client';
import { use } from 'react';
import PermissionGuard from '@/components/admin/PermissionGuard';
import PageForm from '@/components/admin/PageForm';

type Props = { params: Promise<{ id: string }> };

export default function EditPagePage({ params }: Props) {
  const { id } = use(params);
  return (
    <PermissionGuard permission="pages.edit">
      <PageForm pageId={parseInt(id)} />
    </PermissionGuard>
  );
}
