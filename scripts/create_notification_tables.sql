-- Create notification tables for push notification system
-- These tables store notification history and allow notifications to appear in mobile app inbox

-- Table for notification categories (optional, for organizing notifications)
CREATE TABLE IF NOT EXISTS `notification_categories` (
  `id` INT(11) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NOT NULL,
  `icon` VARCHAR(50) DEFAULT NULL,
  `color` VARCHAR(20) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY `unique_slug` (`slug`),
  KEY `idx_deleted` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table for storing all push notifications (both broadcast and event-triggered)
CREATE TABLE IF NOT EXISTS `push_notifications` (
  `id` INT(11) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `body` TEXT NOT NULL,
  `category_id` INT(11) UNSIGNED DEFAULT NULL,
  `image_url` VARCHAR(500) DEFAULT NULL,
  `action_url` VARCHAR(500) DEFAULT NULL,
  `audience_type` ENUM('all', 'city', 'partner', 'specific_user', 'category', 'role', 'custom') DEFAULT 'all',
  `audience_filter` TEXT DEFAULT NULL COMMENT 'JSON filter for targeting specific audiences',
  `status` ENUM('draft', 'scheduled', 'sent', 'failed') DEFAULT 'draft',
  `scheduled_at` TIMESTAMP NULL DEFAULT NULL,
  `sent_at` TIMESTAMP NULL DEFAULT NULL,
  `created_by` INT(11) DEFAULT NULL COMMENT 'Admin user who created this notification',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  KEY `idx_category` (`category_id`),
  KEY `idx_status` (`status`),
  KEY `idx_audience` (`audience_type`),
  KEY `idx_scheduled` (`scheduled_at`),
  KEY `idx_deleted` (`deleted_at`),
  CONSTRAINT `fk_push_notifications_category` FOREIGN KEY (`category_id`) REFERENCES `notification_categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table for tracking notification delivery to individual recipients
CREATE TABLE IF NOT EXISTS `push_notification_logs` (
  `id` INT(11) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `notification_id` INT(11) UNSIGNED NOT NULL,
  `recipient_type` ENUM('user', 'customer', 'partner') NOT NULL,
  `recipient_id` INT(11) NOT NULL,
  `recipient_name` VARCHAR(255) DEFAULT NULL,
  `fcm_token` VARCHAR(500) DEFAULT NULL,
  `status` ENUM('pending', 'sent', 'delivered', 'failed', 'opened', 'clicked') DEFAULT 'pending',
  `error_message` TEXT DEFAULT NULL,
  `sent_at` TIMESTAMP NULL DEFAULT NULL,
  `delivered_at` TIMESTAMP NULL DEFAULT NULL,
  `opened_at` TIMESTAMP NULL DEFAULT NULL,
  `clicked_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_notification` (`notification_id`),
  KEY `idx_recipient` (`recipient_type`, `recipient_id`),
  KEY `idx_status` (`status`),
  KEY `idx_sent` (`sent_at`),
  CONSTRAINT `fk_push_notification_logs_notification` FOREIGN KEY (`notification_id`) REFERENCES `push_notifications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default notification categories
INSERT INTO `notification_categories` (`name`, `slug`, `icon`, `color`, `description`) VALUES
  ('Account', 'account', 'user', '#4A2372', 'Account-related notifications (registration, login, deletion)'),
  ('Bookings', 'booking', 'calendar', '#FF6B35', 'Booking-related notifications (new, accepted, completed, cancelled)'),
  ('Payments', 'payment', 'credit-card', '#00C853', 'Payment-related notifications (successful, failed, refunds)'),
  ('Withdrawals', 'withdrawal', 'dollar-sign', '#2196F3', 'Withdrawal request notifications'),
  ('System', 'system', 'bell', '#757575', 'System notifications and announcements'),
  ('Promotions', 'promotion', 'gift', '#FF4081', 'Promotional offers and discounts')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `icon` = VALUES(`icon`),
  `color` = VALUES(`color`),
  `description` = VALUES(`description`);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS `idx_logs_recipient_status` ON `push_notification_logs` (`recipient_type`, `recipient_id`, `status`);
CREATE INDEX IF NOT EXISTS `idx_notifications_sent` ON `push_notifications` (`status`, `sent_at`);
