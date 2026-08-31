-- Migrate existing FCM tokens from customers table to customer_fcm_tokens
INSERT INTO customer_fcm_tokens (customer_id, fcm_token, device_type, created_at)
SELECT 
    id,
    fcm_token,
    'android' as device_type,
    created_at
FROM customers
WHERE fcm_token IS NOT NULL 
  AND fcm_token != ''
  AND deleted_at IS NULL
ON DUPLICATE KEY UPDATE last_used_at = CURRENT_TIMESTAMP;

-- Migrate existing FCM tokens from partners table to partner_fcm_tokens
INSERT INTO partner_fcm_tokens (partner_id, fcm_token, device_type, created_at)
SELECT 
    id,
    fcm_token,
    'android' as device_type,
    created_at
FROM partners
WHERE fcm_token IS NOT NULL 
  AND fcm_token != ''
  AND deleted_at IS NULL
ON DUPLICATE KEY UPDATE last_used_at = CURRENT_TIMESTAMP;

-- Show migration results
SELECT 'Customer tokens migrated:' as info, COUNT(*) as count FROM customer_fcm_tokens WHERE deleted_at IS NULL
UNION ALL
SELECT 'Partner tokens migrated:' as info, COUNT(*) as count FROM partner_fcm_tokens WHERE deleted_at IS NULL;
