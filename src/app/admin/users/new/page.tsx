'use client';
import PermissionGuard from '@/components/admin/PermissionGuard';
import UserForm from '@/components/admin/UserForm';

export default function NewUserPage() {
  return (
    <PermissionGuard permission="users.create">
      <UserForm />
    </PermissionGuard>
  );
}
