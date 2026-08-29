-- ============================================================================
-- Add Punjabi Language Support
-- ============================================================================
-- This script adds Punjabi language to the database and creates sample translations
-- Run this script in your MySQL database

-- ============================================================================
-- 1. Add Punjabi Language (if not exists)
-- ============================================================================
INSERT INTO languages (code, name, native_name, is_active, sort_order)
VALUES ('pa', 'Punjabi', 'ਪੰਜਾਬੀ', TRUE, 5)
ON DUPLICATE KEY UPDATE 
  name = 'Punjabi',
  native_name = 'ਪੰਜਾਬੀ',
  is_active = TRUE,
  sort_order = 5;

-- ============================================================================
-- 2. Create Translation Version for Punjabi
-- ============================================================================
INSERT INTO translation_versions (language_code, version, updated_at)
VALUES ('pa', '1.0.0', NOW())
ON DUPLICATE KEY UPDATE 
  version = '1.0.0',
  updated_at = NOW();

-- ============================================================================
-- 3. Add Punjabi Translations
-- ============================================================================
-- Note: Add all 342+ translation keys here
-- Below are sample translations for the most important keys

-- Language Selection Screen
INSERT INTO translations (language_code, translation_key, translation_value) VALUES
('pa', 'chooseYourLanguage', 'ਆਪਣੀ ਭਾਸ਼ਾ ਚੁਣੋ'),
('pa', 'continueButton', 'ਜਾਰੀ ਰੱਖੋ')
ON DUPLICATE KEY UPDATE translation_value = VALUES(translation_value);

-- Auth Screens
INSERT INTO translations (language_code, translation_key, translation_value) VALUES
('pa', 'enterMobileNumber', 'ਮੋਬਾਈਲ ਨੰਬਰ ਦਰਜ ਕਰੋ'),
('pa', 'enterYourMobileNumber', 'ਆਪਣਾ 10-ਅੰਕਾਂ ਦਾ ਮੋਬਾਈਲ ਨੰਬਰ ਦਰਜ ਕਰੋ'),
('pa', 'getOTP', 'OTP ਪ੍ਰਾਪਤ ਕਰੋ'),
('pa', 'pleaseEnterValid10Digit', 'ਕਿਰਪਾ ਕਰਕੇ ਇੱਕ ਵੈਧ 10-ਅੰਕਾਂ ਦਾ ਮੋਬਾਈਲ ਨੰਬਰ ਦਰਜ ਕਰੋ'),
('pa', 'sendingOTP', 'OTP ਭੇਜਿਆ ਜਾ ਰਿਹਾ ਹੈ…'),
('pa', 'byContinuingYouAgree', 'ਜਾਰੀ ਰੱਖ ਕੇ, ਤੁਸੀਂ ਸਾਡੇ ਨਾਲ ਸਹਿਮਤ ਹੋ'),
('pa', 'termsAndConditions', 'ਨਿਯਮ ਅਤੇ ਸ਼ਰਤਾਂ'),
('pa', 'and', 'ਅਤੇ'),
('pa', 'privacyPolicy', 'ਗੋਪਨੀਯਤਾ ਨੀਤੀ'),
('pa', 'enterOTP', 'OTP ਦਰਜ ਕਰੋ'),
('pa', 'weHaveSentOTP', 'ਅਸੀਂ ਇੱਕ OTP ਭੇਜਿਆ ਹੈ'),
('pa', 'verify', 'ਤਸਦੀਕ ਕਰੋ'),
('pa', 'verifying', 'ਤਸਦੀਕ ਕੀਤੀ ਜਾ ਰਹੀ ਹੈ…'),
('pa', 'resendOTP', 'OTP ਦੁਬਾਰਾ ਭੇਜੋ'),
('pa', 'resendIn', 'ਵਿੱਚ ਦੁਬਾਰਾ ਭੇਜੋ'),
('pa', 'seconds', 'ਸਕਿੰਟ'),
('pa', 'pleaseEnterValid6Digit', 'ਕਿਰਪਾ ਕਰਕੇ ਇੱਕ ਵੈਧ 6-ਅੰਕਾਂ ਦਾ OTP ਕੋਡ ਦਰਜ ਕਰੋ'),
('pa', 'otpVerificationFailed', 'OTP ਤਸਦੀਕ ਅਸਫਲ ਰਹੀ')
ON DUPLICATE KEY UPDATE translation_value = VALUES(translation_value);

-- Create Profile Flow
INSERT INTO translations (language_code, translation_key, translation_value) VALUES
('pa', 'createYourProfile', 'ਆਪਣੀ ਪ੍ਰੋਫਾਈਲ ਬਣਾਓ'),
('pa', 'letsStartWithBasicInfo', 'ਆਓ ਤੁਹਾਡੀ ਬੁਨਿਆਦੀ ਜਾਣਕਾਰੀ ਨਾਲ ਸ਼ੁਰੂ ਕਰੀਏ'),
('pa', 'fullName', 'ਪੂਰਾ ਨਾਮ'),
('pa', 'enterYourFullName', 'ਆਪਣਾ ਪੂਰਾ ਨਾਮ ਦਰਜ ਕਰੋ'),
('pa', 'selectGender', 'ਲਿੰਗ ਚੁਣੋ'),
('pa', 'male', 'ਮਰਦ'),
('pa', 'female', 'ਔਰਤ'),
('pa', 'yourNameMustMatch', 'ਤੁਹਾਡਾ ਨਾਮ ਸਫਲ KYC ਤਸਦੀਕ ਲਈ ਤੁਹਾਡੇ ਕਾਨੂੰਨੀ ਦਸਤਾਵੇਜ਼ਾਂ ਨਾਲ ਮੇਲ ਖਾਣਾ ਚਾਹੀਦਾ ਹੈ'),
('pa', 'pleaseEnterYourFullName', 'ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਪੂਰਾ ਨਾਮ ਦਰਜ ਕਰੋ'),
('pa', 'pleaseSelectYourGender', 'ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਲਿੰਗ ਚੁਣੋ'),
('pa', 'exitRegistration', 'ਰਜਿਸਟ੍ਰੇਸ਼ਨ ਤੋਂ ਬਾਹਰ ਨਿਕਲੋ?'),
('pa', 'yourProgressWillBeLost', 'ਤੁਹਾਡੀ ਤਰੱਕੀ ਗੁਆਚ ਜਾਵੇਗੀ। ਕੀ ਤੁਸੀਂ ਯਕੀਨੀ ਤੌਰ ਤੇ ਬਾਹਰ ਨਿਕਲਣਾ ਚਾਹੁੰਦੇ ਹੋ?'),
('pa', 'cancel', 'ਰੱਦ ਕਰੋ'),
('pa', 'exit', 'ਬਾਹਰ ਨਿਕਲੋ'),
('pa', 'selectYourCategory', 'ਆਪਣੀ ਸ਼੍ਰੇਣੀ ਚੁਣੋ'),
('pa', 'chooseTheService', 'ਉਹ ਸੇਵਾ ਸ਼੍ਰੇਣੀ ਚੁਣੋ ਜੋ ਤੁਸੀਂ ਪ੍ਰਦਾਨ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ'),
('pa', 'next', 'ਅੱਗੇ'),
('pa', 'pleaseSelectAtLeastOne', 'ਕਿਰਪਾ ਕਰਕੇ ਘੱਟੋ-ਘੱਟ ਇੱਕ ਸ਼੍ਰੇਣੀ ਚੁਣੋ'),
('pa', 'doYouHaveATeam', 'ਕੀ ਤੁਹਾਡੇ ਕੋਲ ਇੱਕ ਟੀਮ ਹੈ?'),
('pa', 'ifYouWorkWithTeam', 'ਜੇ ਤੁਸੀਂ ਇੱਕ ਟੀਮ ਨਾਲ ਕੰਮ ਕਰਦੇ ਹੋ, ਤਾਂ ਤੁਸੀਂ ਬਾਅਦ ਵਿੱਚ ਆਪਣੇ ਡੈਸ਼ਬੋਰਡ ਤੋਂ ਉਹਨਾਂ ਦਾ ਪ੍ਰਬੰਧਨ ਕਰ ਸਕਦੇ ਹੋ'),
('pa', 'yesIHaveATeam', 'ਹਾਂ, ਮੇਰੇ ਕੋਲ ਇੱਕ ਟੀਮ ਹੈ'),
('pa', 'noJustMe', 'ਨਹੀਂ, ਸਿਰਫ਼ ਮੈਂ'),
('pa', 'pleaseSelectAnOption', 'ਕਿਰਪਾ ਕਰਕੇ ਇੱਕ ਵਿਕਲਪ ਚੁਣੋ'),
('pa', 'doYouHaveVehicle', 'ਕੀ ਤੁਹਾਡੇ ਕੋਲ ਵਾਹਨ ਹੈ?'),
('pa', 'selectVehicleType', 'ਉਹ ਵਾਹਨ ਦੀ ਕਿਸਮ ਚੁਣੋ ਜੋ ਤੁਹਾਡੇ ਕੋਲ ਹੈ'),
('pa', 'noVehicle', 'ਕੋਈ ਵਾਹਨ ਨਹੀਂ'),
('pa', 'bike', 'ਬਾਈਕ'),
('pa', 'car', 'ਕਾਰ'),
('pa', 'van', 'ਵੈਨ'),
('pa', 'truck', 'ਟਰੱਕ'),
('pa', 'pleaseSelectVehicleType', 'ਕਿਰਪਾ ਕਰਕੇ ਇੱਕ ਵਾਹਨ ਦੀ ਕਿਸਮ ਚੁਣੋ'),
('pa', 'goBack', 'ਵਾਪਸ ਜਾਓ')
ON DUPLICATE KEY UPDATE translation_value = VALUES(translation_value);

-- Common Translations
INSERT INTO translations (language_code, translation_key, translation_value) VALUES
('pa', 'loading', 'ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ...'),
('pa', 'error', 'ਗਲਤੀ'),
('pa', 'success', 'ਸਫਲਤਾ'),
('pa', 'ok', 'ਠੀਕ ਹੈ'),
('pa', 'done', 'ਹੋ ਗਿਆ'),
('pa', 'skip', 'ਛੱਡੋ'),
('pa', 'back', 'ਵਾਪਸ'),
('pa', 'close', 'ਬੰਦ ਕਰੋ'),
('pa', 'delete', 'ਮਿਟਾਓ'),
('pa', 'edit', 'ਸੰਪਾਦਿਤ ਕਰੋ'),
('pa', 'update', 'ਅੱਪਡੇਟ ਕਰੋ'),
('pa', 'confirm', 'ਪੁਸ਼ਟੀ ਕਰੋ'),
('pa', 'save', 'ਸੁਰੱਖਿਅਤ ਕਰੋ'),
('pa', 'saving', 'ਸੁਰੱਖਿਅਤ ਕੀਤਾ ਜਾ ਰਿਹਾ ਹੈ…'),
('pa', 'yes', 'ਹਾਂ'),
('pa', 'no', 'ਨਹੀਂ')
ON DUPLICATE KEY UPDATE translation_value = VALUES(translation_value);

-- Dashboard
INSERT INTO translations (language_code, translation_key, translation_value) VALUES
('pa', 'dashboard', 'ਡੈਸ਼ਬੋਰਡ'),
('pa', 'hello', 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ'),
('pa', 'partner', 'ਸਾਥੀ'),
('pa', 'profile', 'ਪ੍ਰੋਫਾਈਲ'),
('pa', 'notifications', 'ਸੂਚਨਾਵਾਂ'),
('pa', 'logout', 'ਲੌਗ ਆਉਟ'),
('pa', 'youAreOnline', 'ਤੁਸੀਂ ਔਨਲਾਈਨ ਹੋ'),
('pa', 'youAreOffline', 'ਤੁਸੀਂ ਔਫਲਾਈਨ ਹੋ'),
('pa', 'availableBalance', 'ਉਪਲਬਧ ਬਕਾਇਆ'),
('pa', 'todaysEarnings', 'ਅੱਜ ਦੀ ਕਮਾਈ'),
('pa', 'completedJobs', 'ਪੂਰੇ ਹੋਏ ਕੰਮ')
ON DUPLICATE KEY UPDATE translation_value = VALUES(translation_value);

-- ============================================================================
-- 4. Verify Installation
-- ============================================================================
-- Check if Punjabi language is added
SELECT * FROM languages WHERE code = 'pa';

-- Check translation count for Punjabi
SELECT COUNT(*) as punjabi_translation_count 
FROM translations 
WHERE language_code = 'pa';

-- Check version
SELECT * FROM translation_versions WHERE language_code = 'pa';

-- ============================================================================
-- IMPORTANT: Add Remaining Translations
-- ============================================================================
-- This script only includes ~80 sample translations
-- You need to add the remaining ~260 translations for all features:
-- 
-- - Identity Verification (18 keys)
-- - Bank Verification (7 keys)
-- - Review Application (17 keys)
-- - Application Status (10 keys)
-- - Edit Profile (12 keys)
-- - Job Screens (20 keys)
-- - Job Request Dialog (15 keys)
-- - OTP Verification (8 keys)
-- - Work Tracking (9 keys)
-- - Work Completed (11 keys)
-- - Payment Screens (9 keys)
-- - Report Issue (9 keys)
-- - Reviews (8 keys)
-- - Drawer (9 keys)
-- - And more...
--
-- Total: 342 translation keys
--
-- You can add them through the Admin Panel:
-- Admin → Languages → Punjabi → Edit Translations
-- ============================================================================
