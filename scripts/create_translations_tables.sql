-- ============================================================================
-- Dynamic Translations System
-- ============================================================================
-- This enables admin to manage app translations dynamically without app updates
-- Admin can add new languages and modify translations via admin panel
-- ============================================================================

-- Table: languages
-- Stores all available languages in the system
CREATE TABLE IF NOT EXISTS languages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL COMMENT 'ISO 639-1 code (en, hi, gu, mr, pa, ta, bn, etc.)',
  name VARCHAR(50) NOT NULL COMMENT 'English name (English, Hindi, Punjabi)',
  native_name VARCHAR(50) NOT NULL COMMENT 'Native name (English, हिन्दी, ਪੰਜਾਬੀ)',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Whether language is available in app',
  sort_order INT DEFAULT 0 COMMENT 'Display order in language selection',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: translations
-- Stores all translation key-value pairs for each language
CREATE TABLE IF NOT EXISTS translations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  language_code VARCHAR(10) NOT NULL COMMENT 'References languages.code',
  translation_key VARCHAR(100) NOT NULL COMMENT 'Unique key (welcomeMessage, loginButton, etc.)',
  translation_value TEXT NOT NULL COMMENT 'Translated text in target language',
  category VARCHAR(50) DEFAULT 'general' COMMENT 'Category for organization (auth, dashboard, profile, etc.)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_translation (language_code, translation_key),
  INDEX idx_language (language_code),
  INDEX idx_key (translation_key),
  INDEX idx_category (category),
  INDEX idx_updated (updated_at),
  FOREIGN KEY (language_code) REFERENCES languages(code) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: translation_versions
-- Tracks version history for cache invalidation
CREATE TABLE IF NOT EXISTS translation_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  language_code VARCHAR(10) NOT NULL,
  version VARCHAR(20) NOT NULL COMMENT 'Semantic version (1.0.0, 1.0.1, etc.)',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by INT DEFAULT NULL COMMENT 'Admin user who made the update',
  change_summary TEXT COMMENT 'What was changed',
  UNIQUE KEY unique_language_version (language_code),
  INDEX idx_language (language_code),
  FOREIGN KEY (language_code) REFERENCES languages(code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Insert Default Languages (English, Hindi, Gujarati, Marathi)
-- ============================================================================

INSERT INTO languages (code, name, native_name, is_active, sort_order) VALUES
('en', 'English', 'English', TRUE, 1),
('hi', 'Hindi', 'हिन्दी', TRUE, 2),
('gu', 'Gujarati', 'ગુજરાતી', TRUE, 3),
('mr', 'Marathi', 'मराठी', TRUE, 4)
ON DUPLICATE KEY UPDATE 
  name = VALUES(name),
  native_name = VALUES(native_name),
  is_active = VALUES(is_active),
  sort_order = VALUES(sort_order);

-- ============================================================================
-- Initialize Translation Versions
-- ============================================================================

INSERT INTO translation_versions (language_code, version, change_summary) VALUES
('en', '1.0.0', 'Initial English translations'),
('hi', '1.0.0', 'Initial Hindi translations'),
('gu', '1.0.0', 'Initial Gujarati translations'),
('mr', '1.0.0', 'Initial Marathi translations')
ON DUPLICATE KEY UPDATE version = VALUES(version);

-- ============================================================================
-- Sample Translations (Will be imported from ARB files via script)
-- ============================================================================
-- Note: Run import_arb_to_db.js script to import all existing ARB translations
-- This is just a sample to show the structure

INSERT INTO translations (language_code, translation_key, translation_value, category) VALUES
-- English Samples
('en', 'appName', 'Work Wala', 'general'),
('en', 'welcomeMessage', 'Welcome to Work Wala', 'general'),
('en', 'chooseYourLanguage', 'Choose Your Language', 'language'),

-- Hindi Samples
('hi', 'appName', 'वर्क वाला', 'general'),
('hi', 'welcomeMessage', 'वर्क वाला में आपका स्वागत है', 'general'),
('hi', 'chooseYourLanguage', 'अपनी भाषा चुनें', 'language'),

-- Gujarati Samples
('gu', 'appName', 'વર્ક વાલા', 'general'),
('gu', 'welcomeMessage', 'વર્ક વાલામાં આપનું સ્વાગત છે', 'general'),
('gu', 'chooseYourLanguage', 'તમારી ભાષા પસંદ કરો', 'language'),

-- Marathi Samples
('mr', 'appName', 'वर्क वाला', 'general'),
('mr', 'welcomeMessage', 'वर्क वाला मध्ये आपले स्वागत आहे', 'general'),
('mr', 'chooseYourLanguage', 'तुमची भाषा निवडा', 'language')
ON DUPLICATE KEY UPDATE 
  translation_value = VALUES(translation_value),
  category = VALUES(category);

-- ============================================================================
-- Useful Queries for Admin Panel
-- ============================================================================

-- Get all active languages
-- SELECT * FROM languages WHERE is_active = TRUE ORDER BY sort_order;

-- Get all translations for a language
-- SELECT translation_key, translation_value FROM translations WHERE language_code = 'en';

-- Get translation version
-- SELECT version, updated_at FROM translation_versions WHERE language_code = 'en';

-- Search translations
-- SELECT * FROM translations WHERE translation_value LIKE '%search%';

-- Get missing translations (keys that exist in English but not in other languages)
-- SELECT t1.translation_key 
-- FROM translations t1 
-- WHERE t1.language_code = 'en' 
-- AND NOT EXISTS (
--   SELECT 1 FROM translations t2 
--   WHERE t2.language_code = 'hi' 
--   AND t2.translation_key = t1.translation_key
-- );

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
