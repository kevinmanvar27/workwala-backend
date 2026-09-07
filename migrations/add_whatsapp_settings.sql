-- Migration: Add WhatsApp Meta API Configuration Settings
-- Description: Adds WhatsApp configuration fields to the settings table
-- Date: 2026-09-07

-- Insert WhatsApp configuration settings
-- These will be used to send OTPs via WhatsApp using Meta Business API

INSERT INTO settings (key_name, value, group_name, created_at, updated_at) VALUES
('whatsapp_enabled', '0', 'sms', NOW(), NOW()),
('whatsapp_phone_number_id', '', 'sms', NOW(), NOW()),
('whatsapp_business_account_id', '', 'sms', NOW(), NOW()),
('whatsapp_access_token', '', 'sms', NOW(), NOW()),
('whatsapp_webhook_verify_token', '', 'sms', NOW(), NOW())
ON DUPLICATE KEY UPDATE 
  key_name = key_name,
  updated_at = NOW();

-- Verify the settings were added
SELECT key_name, value, group_name 
FROM settings 
WHERE key_name LIKE 'whatsapp_%' 
ORDER BY key_name;
