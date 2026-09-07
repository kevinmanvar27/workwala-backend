-- ============================================================================
-- WebRTC Calling System Migration
-- ============================================================================
-- Creates tables for managing WebRTC video/audio calls between customers and partners
-- Uses existing phone numbers for identification
-- ============================================================================

-- Call records table
CREATE TABLE IF NOT EXISTS `calls` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `call_id` VARCHAR(100) NOT NULL COMMENT 'Unique call identifier (UUID)',
  `caller_type` ENUM('customer', 'partner') NOT NULL COMMENT 'Who initiated the call',
  `caller_id` INT(11) NOT NULL COMMENT 'ID from customers or partners table',
  `caller_phone` VARCHAR(15) NOT NULL COMMENT 'Caller phone number',
  `receiver_type` ENUM('customer', 'partner') NOT NULL COMMENT 'Who receives the call',
  `receiver_id` INT(11) NOT NULL COMMENT 'ID from customers or partners table',
  `receiver_phone` VARCHAR(15) NOT NULL COMMENT 'Receiver phone number',
  `status` ENUM('calling', 'ringing', 'connected', 'ended', 'missed', 'rejected', 'failed') NOT NULL DEFAULT 'calling',
  `call_type` ENUM('audio', 'video') NOT NULL DEFAULT 'video',
  `started_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'When call was connected',
  `ended_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'When call was ended',
  `duration` INT(11) DEFAULT 0 COMMENT 'Call duration in seconds',
  `connection_type` ENUM('direct', 'relay') DEFAULT NULL COMMENT 'P2P direct or TURN relay',
  `end_reason` VARCHAR(100) DEFAULT NULL COMMENT 'Why call ended (hangup, timeout, error)',
  `booking_id` INT(11) DEFAULT NULL COMMENT 'Optional: linked booking',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `call_id` (`call_id`),
  KEY `idx_caller` (`caller_type`, `caller_id`),
  KEY `idx_receiver` (`receiver_type`, `receiver_id`),
  KEY `idx_caller_phone` (`caller_phone`),
  KEY `idx_receiver_phone` (`receiver_phone`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_booking_id` (`booking_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='WebRTC call records';

-- WebRTC signaling sessions (for active calls)
CREATE TABLE IF NOT EXISTS `call_sessions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `call_id` VARCHAR(100) NOT NULL COMMENT 'References calls.call_id',
  `user_type` ENUM('customer', 'partner') NOT NULL,
  `user_id` INT(11) NOT NULL,
  `socket_id` VARCHAR(100) NOT NULL COMMENT 'WebSocket connection ID',
  `ice_candidates` JSON DEFAULT NULL COMMENT 'Stored ICE candidates',
  `sdp_offer` TEXT DEFAULT NULL COMMENT 'SDP offer',
  `sdp_answer` TEXT DEFAULT NULL COMMENT 'SDP answer',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
  PRIMARY KEY (`id`),
  KEY `idx_call_id` (`call_id`),
  KEY `idx_user` (`user_type`, `user_id`),
  KEY `idx_socket_id` (`socket_id`),
  KEY `idx_is_active` (`is_active`),
  FOREIGN KEY (`call_id`) REFERENCES `calls`(`call_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Active WebRTC signaling sessions';

-- Call quality metrics (optional, for monitoring)
CREATE TABLE IF NOT EXISTS `call_metrics` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `call_id` VARCHAR(100) NOT NULL,
  `user_type` ENUM('customer', 'partner') NOT NULL,
  `user_id` INT(11) NOT NULL,
  `packet_loss` DECIMAL(5,2) DEFAULT NULL COMMENT 'Percentage',
  `jitter` INT(11) DEFAULT NULL COMMENT 'Milliseconds',
  `latency` INT(11) DEFAULT NULL COMMENT 'Milliseconds',
  `bitrate` INT(11) DEFAULT NULL COMMENT 'Kbps',
  `connection_quality` ENUM('excellent', 'good', 'fair', 'poor') DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  PRIMARY KEY (`id`),
  KEY `idx_call_id` (`call_id`),
  FOREIGN KEY (`call_id`) REFERENCES `calls`(`call_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Call quality monitoring';

-- TURN server configuration (stored in DB for easy management)
CREATE TABLE IF NOT EXISTS `turn_config` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `environment` ENUM('development', 'staging', 'production') NOT NULL DEFAULT 'development',
  `turn_server` VARCHAR(255) NOT NULL COMMENT 'TURN server domain/IP',
  `stun_port` INT(11) NOT NULL DEFAULT 3478,
  `turn_port` INT(11) NOT NULL DEFAULT 3478,
  `turns_port` INT(11) NOT NULL DEFAULT 5349 COMMENT 'Secure TURN port',
  `turn_secret` VARCHAR(255) NOT NULL COMMENT 'Shared secret for TURN authentication',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
  PRIMARY KEY (`id`),
  KEY `idx_environment` (`environment`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='TURN server configuration';

-- Insert default TURN configurations
INSERT INTO `turn_config` (`environment`, `turn_server`, `stun_port`, `turn_port`, `turns_port`, `turn_secret`, `is_active`) VALUES
('development', 'localhost', 3478, 3478, 5349, 'mySecretKey123', 1),
('staging', 'turn-staging.joinlinko.com', 3478, 3478, 5349, 'CHANGE_IN_PRODUCTION', 0),
('production', 'turn.joinlinko.com', 3478, 3478, 5349, 'CHANGE_IN_PRODUCTION', 0)
ON DUPLICATE KEY UPDATE `updated_at` = CURRENT_TIMESTAMP();
