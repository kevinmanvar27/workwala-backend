-- Initialize WebRTC settings in the database
-- Run this script with: mysql -u root workwala < scripts/init_webrtc_settings.sql

-- Enable WebRTC calling (use '1' for enabled, '0' for disabled)
INSERT INTO settings (key_name, value, created_at, updated_at)
VALUES ('webrtc_enabled', '1', NOW(), NOW())
ON DUPLICATE KEY UPDATE value = '1', updated_at = NOW();

-- Set TURN server (non-secure)
INSERT INTO settings (key_name, value, created_at, updated_at)
VALUES ('turn_server', 'localhost:3478', NOW(), NOW())
ON DUPLICATE KEY UPDATE value = 'localhost:3478', updated_at = NOW();

-- Set TURNS server (secure)
INSERT INTO settings (key_name, value, created_at, updated_at)
VALUES ('turns_server', 'localhost:5349', NOW(), NOW())
ON DUPLICATE KEY UPDATE value = 'localhost:5349', updated_at = NOW();

-- Set TURN username (optional, can be empty for development)
INSERT INTO settings (key_name, value, created_at, updated_at)
VALUES ('turn_username', '', NOW(), NOW())
ON DUPLICATE KEY UPDATE value = '', updated_at = NOW();

-- Set TURN credential (optional, can be empty for development)
INSERT INTO settings (key_name, value, created_at, updated_at)
VALUES ('turn_credential', '', NOW(), NOW())
ON DUPLICATE KEY UPDATE value = '', updated_at = NOW();

-- Verify settings
SELECT key_name, value, updated_at FROM settings WHERE key_name LIKE '%turn%' OR key_name = 'webrtc_enabled';
