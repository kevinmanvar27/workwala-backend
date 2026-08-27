-- Check current FCM settings in database
-- Run this in your MySQL client (phpMyAdmin or command line)

SELECT 
    key_name,
    CASE 
        WHEN key_name = 'fcm_private_key' THEN 
            CONCAT(LEFT(value, 50), '... (', LENGTH(value), ' chars total)')
        ELSE value
    END as value_preview,
    group_name,
    created_at,
    updated_at
FROM settings 
WHERE key_name IN ('fcm_project_id', 'fcm_client_email', 'fcm_private_key')
    AND deleted_at IS NULL
ORDER BY key_name;
