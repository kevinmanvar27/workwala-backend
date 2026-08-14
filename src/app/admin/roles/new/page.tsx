'use client';
import PermissionGuard from '@/components/admin/PermissionGuard';
import RoleForm from '@/components/admin/RoleForm';

export default function NewRolePage() {
  return (
    <PermissionGuard permission="roles.create">
      <RoleForm />
    </PermissionGuard>
  );
}
