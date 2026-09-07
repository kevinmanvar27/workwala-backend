-- Migration: Add service area management permission
-- Description: Creates permission for managing service coverage areas
-- Date: 2026-09-06

-- Insert permission for service area management
INSERT INTO permissions (name, slug, module, description)
VALUES (
  'Manage Service Areas',
  'service-areas.manage',
  'Service Areas',
  'Create, edit, delete, and toggle service coverage areas'
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  module = VALUES(module),
  description = VALUES(description);

-- Assign permission to super-admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'super-admin' 
  AND p.slug = 'service-areas.manage'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
