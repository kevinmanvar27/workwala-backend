'use client';
import { use } from 'react';
import PermissionGuard from '@/components/admin/PermissionGuard';
import RoleForm from '@/components/admin/RoleForm';

type Props = { params: Promise<{ id: string }> };

export default function EditRolePage({ params }: Props) {
  const { id } = use(params);
  return (
    <PermissionGuard permission="roles.edit">
      <RoleForm roleId={parseInt(id)} />
    </PermissionGuard>
  );
}
