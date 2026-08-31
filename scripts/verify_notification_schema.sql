-- Verify Notification System Database Schema
-- Run this in phpMyAdmin to verify all tables exist and have correct structure

-- Check if notification_categories table exists and has data
SELECT 'notification_categories' as table_name, COUNT(*) as row_count FROM notification_categories;
SELECT * FROM notification_categories ORDER BY id;

-- Check if push_notifications table exists
SELECT 'push_notifications' as table_name, COUNT(*) as row_count FROM push_notifications;
DESCRIBE push_notifications;

-- Check if push_notification_logs table exists
SELECT 'push_notification_logs' as table_name, COUNT(*) as row_count FROM push_notification_logs;
DESCRIBE push_notification_logs;

-- Check if FCM token tables exist
SELECT 'user_fcm_tokens' as table_name, COUNT(*) as row_count FROM user_fcm_tokens;
SELECT 'customer_fcm_tokens' as table_name, COUNT(*) as row_count FROM customer_fcm_tokens;
SELECT 'partner_fcm_tokens' as table_name, COUNT(*) as row_count FROM partner_fcm_tokens;

-- Check recent notifications (last 10)
SELECT 
  pn.id,
  pn.title,
  pn.body,
  nc.name as category,
  pn.audience_type,
  pn.status,
  pn.created_at
FROM push_notifications pn
LEFT JOIN notification_categories nc ON pn.category_id = nc.id
ORDER BY pn.created_at DESC
LIMIT 10;

-- Check recent notification logs (last 20)
SELECT 
  pnl.id,
  pn.title,
  pnl.recipient_type,
  pnl.recipient_id,
  pnl.recipient_name,
  pnl.status,
  pnl.sent_at,
  pnl.opened_at,
  pnl.created_at
FROM push_notification_logs pnl
INNER JOIN push_notifications pn ON pnl.notification_id = pn.id
ORDER BY pnl.created_at DESC
LIMIT 20;

-- Check notification settings
SELECT 
  setting_key,
  setting_value,
  description
FROM settings
WHERE setting_key LIKE '%notify%' OR setting_key LIKE '%push%'
ORDER BY setting_key;

-- Count notifications by category
SELECT 
  nc.name as category,
  COUNT(pn.id) as notification_count
FROM notification_categories nc
LEFT JOIN push_notifications pn ON nc.id = pn.category_id
GROUP BY nc.id, nc.name
ORDER BY notification_count DESC;

-- Count notification logs by recipient type
SELECT 
  recipient_type,
  status,
  COUNT(*) as count
FROM push_notification_logs
GROUP BY recipient_type, status
ORDER BY recipient_type, status;

-- Check for any notifications without logs (potential issue)
SELECT 
  pn.id,
  pn.title,
  pn.created_at,
  COUNT(pnl.id) as log_count
FROM push_notifications pn
LEFT JOIN push_notification_logs pnl ON pn.id = pnl.notification_id
WHERE pn.status = 'sent'
GROUP BY pn.id, pn.title, pn.created_at
HAVING log_count = 0
ORDER BY pn.created_at DESC;

-- Check FCM token counts
SELECT 'Admin Users' as user_type, COUNT(DISTINCT user_id) as user_count, COUNT(*) as token_count FROM user_fcm_tokens WHERE deleted_at IS NULL
UNION ALL
SELECT 'Customers' as user_type, COUNT(DISTINCT customer_id) as user_count, COUNT(*) as token_count FROM customer_fcm_tokens WHERE deleted_at IS NULL
UNION ALL
SELECT 'Partners' as user_type, COUNT(DISTINCT partner_id) as user_count, COUNT(*) as token_count FROM partner_fcm_tokens WHERE deleted_at IS NULL;
