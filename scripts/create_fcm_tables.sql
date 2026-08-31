-- Create FCM token tables for push notifications
-- These tables support multiple FCM tokens per user/customer/partner
-- (users can have multiple devices)

-- Table for admin user FCM tokens
CREATE TABLE IF NOT EXISTS `user_fcm_tokens` (
  `id` INT(11) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT(11) NOT NULL,
  `fcm_token` VARCHAR(500) NOT NULL,
  `device_type` ENUM('ios', 'android', 'web') DEFAULT 'android',
  `device_id` VARCHAR(255) DEFAULT NULL,
  `last_used_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY `unique_user_token` (`user_id`, `fcm_token`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_fcm_token` (`fcm_token`(255)),
  CONSTRAINT `fk_user_fcm_tokens_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table for customer FCM tokens
CREATE TABLE IF NOT EXISTS `customer_fcm_tokens` (
  `id` INT(11) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT(11) NOT NULL,
  `fcm_token` VARCHAR(500) NOT NULL,
  `device_type` ENUM('ios', 'android', 'web') DEFAULT 'android',
  `device_id` VARCHAR(255) DEFAULT NULL,
  `last_used_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY `unique_customer_token` (`customer_id`, `fcm_token`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_fcm_token` (`fcm_token`(255)),
  CONSTRAINT `fk_customer_fcm_tokens_customer_id` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table for partner FCM tokens
CREATE TABLE IF NOT EXISTS `partner_fcm_tokens` (
  `id` INT(11) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `partner_id` INT(11) NOT NULL,
  `fcm_token` VARCHAR(500) NOT NULL,
  `device_type` ENUM('ios', 'android', 'web') DEFAULT 'android',
  `device_id` VARCHAR(255) DEFAULT NULL,
  `last_used_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY `unique_partner_token` (`partner_id`, `fcm_token`),
  KEY `idx_partner_id` (`partner_id`),
  KEY `idx_fcm_token` (`fcm_token`(255)),
  CONSTRAINT `fk_partner_fcm_tokens_partner_id` FOREIGN KEY (`partner_id`) REFERENCES `partners` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS `idx_user_fcm_active` ON `user_fcm_tokens` (`user_id`, `deleted_at`);
CREATE INDEX IF NOT EXISTS `idx_customer_fcm_active` ON `customer_fcm_tokens` (`customer_id`, `deleted_at`);
CREATE INDEX IF NOT EXISTS `idx_partner_fcm_active` ON `partner_fcm_tokens` (`partner_id`, `deleted_at`);
