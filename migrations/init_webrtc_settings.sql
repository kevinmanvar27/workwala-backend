-- ============================================================================
-- WebRTC Settings Initialization
-- ============================================================================
-- This script ensures all WebRTC-related settings exist in the settings table
-- Run this after configuring WebRTC in the admin panel to ensure proper setup
-- ============================================================================

-- Insert or update WebRTC enabled flag
INSERT INTO settings (key_name, value, group_name, created_at, updated_at)
VALUES ('webrtc_enabled', '1', 'webrtc', NOW(), NOW())
ON DUPLICATE KEY UPDATE 
  group_name = 'webrtc',
  updated_at = NOW();

-- Insert or update WebRTC environment
INSERT INTO settings (key_name, value, group_name, created_at, updated_at)
VALUES ('webrtc_environment', 'development', 'webrtc', NOW(), NOW())
ON DUPLICATE KEY UPDATE 
  group_name = 'webrtc',
  updated_at = NOW();

-- Insert or update TURN server
INSERT INTO settings (key_name, value, group_name, created_at, updated_at)
VALUES ('turn_server', 'localhost', 'webrtc', NOW(), NOW())
ON DUPLICATE KEY UPDATE 
  group_name = 'webrtc',
  updated_at = NOW();

-- Insert or update STUN port
INSERT INTO settings (key_name, value, group_name, created_at, updated_at)
VALUES ('stun_port', '3478', 'webrtc', NOW(), NOW())
ON DUPLICATE KEY UPDATE 
  group_name = 'webrtc',
  updated_at = NOW();

-- Insert or update TURN port
INSERT INTO settings (key_name, value, group_name, created_at, updated_at)
VALUES ('turn_port', '3478', 'webrtc', NOW(), NOW())
ON DUPLICATE KEY UPDATE 
  group_name = 'webrtc',
  updated_at = NOW();

-- Insert or update TURNS port (secure)
INSERT INTO settings (key_name, value, group_name, created_at, updated_at)
VALUES ('turns_port', '5349', 'webrtc', NOW(), NOW())
ON DUPLICATE KEY UPDATE 
  group_name = 'webrtc',
  updated_at = NOW();

-- Insert or update TURN shared secret
INSERT INTO settings (key_name, value, group_name, created_at, updated_at)
VALUES ('turn_secret', 'mySecretKey123', 'webrtc', NOW(), NOW())
ON DUPLICATE KEY UPDATE 
  group_name = 'webrtc',
  updated_at = NOW();

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this to verify all settings are properly configured
SELECT 
  key_name,
  value,
  group_name,
  updated_at
FROM settings
WHERE group_name = 'webrtc'
ORDER BY key_name;

-- ============================================================================
-- Expected Output:
-- ============================================================================
-- key_name            | value          | group_name | updated_at
-- --------------------|----------------|------------|-------------------
-- stun_port           | 3478           | webrtc     | [timestamp]
-- turn_port           | 3478           | webrtc     | [timestamp]
-- turn_secret         | mySecretKey123 | webrtc     | [timestamp]
-- turn_server         | localhost      | webrtc     | [timestamp]
-- turns_port          | 5349           | webrtc     | [timestamp]
-- webrtc_enabled      | 1              | webrtc     | [timestamp]
-- webrtc_environment  | development    | webrtc     | [timestamp]
-- ============================================================================
