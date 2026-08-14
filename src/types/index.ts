export interface User {
  id: number;
  name: string;
  email: string;
  password?: string;
  avatar?: string | null;
  role_id?: number | null;
  role_name?: string;
  role_slug?: string;
  status: 'active' | 'inactive' | 'banned';
  email_verified_at?: string | null;
  google_id?: string | null;
  apple_id?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: number;
  name: string;
  slug: string;
  description?: string;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  permissions?: Permission[];
  permission_count?: number;
  user_count?: number;
}

export interface Permission {
  id: number;
  name: string;
  slug: string;
  module: string;
  description?: string;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Page {
  id: number;
  title: string;
  slug: string;
  content?: string;
  meta_title?: string;
  meta_description?: string;
  status: 'published' | 'draft';
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Setting {
  id: number;
  key_name: string;
  value: string;
  group_name: string;
}

export interface DeleteAccountRequest {
  id: number;
  email: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: number;
  user_id: number | null;
  user_name: string;
  action: string;
  module: string;
  target_id: number | null;
  target_name: string | null;
  description: string | null;
  ip_address: string | null;
  deleted_at: string | null;
  created_at: string;
}
