-- Add manage_withdrawals permission
-- This script adds the permission needed to access the Withdrawals page in the admin panel

-- Step 1: Add the permission (if it doesn't exist)
INSERT INTO permissions (slug, name, description, category, created_at, updated_at)
SELECT 
  'manage_withdrawals',
  'Manage Withdrawals',
  'View and process partner withdrawal requests',
  'Financial',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE slug = 'manage_withdrawals'
);

-- Step 2: Get the permission ID
-- Run this to see the permission ID:
-- SELECT id, slug, name FROM permissions WHERE slug = 'manage_withdrawals';

-- Step 3: Assign to Super Admin role (usually role_id = 1)
-- Replace 1 with your actual super admin role ID if different
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 
  1,
  (SELECT id FROM permissions WHERE slug = 'manage_withdrawals'),
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions 
  WHERE role_id = 1 
  AND permission_id = (SELECT id FROM permissions WHERE slug = 'manage_withdrawals')
);

-- Verify the permission was added:
SELECT 
  r.id as role_id,
  r.name as role_name,
  p.slug as permission_slug,
  p.name as permission_name
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE p.slug = 'manage_withdrawals';
