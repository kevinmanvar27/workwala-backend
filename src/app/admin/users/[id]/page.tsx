'use client';
import { use } from 'react';
import PermissionGuard from '@/components/admin/PermissionGuard';
import UserForm from '@/components/admin/UserForm';

type Props = { params: Promise<{ id: string }> };

export default function EditUserPage({ params }: Props) {
  const { id } = use(params);
  return (
    <PermissionGuard permission="users.edit">
      <UserForm userId={parseInt(id)} />
    </PermissionGuard>
  );
}
