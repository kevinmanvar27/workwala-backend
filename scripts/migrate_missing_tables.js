/**
 * Migration: Missing Tables for Live Deployment
 *
 * Creates the following tables that are missing on the live server:
 *   - languages               (translation system)
 *   - translations            (translation system)
 *   - translation_versions    (translation system)
 *   - withdrawal_requests     (partner withdrawals)
 *   - user_fcm_tokens         (admin push notifications)
 *   - customer_fcm_tokens     (customer push notifications)
 *   - partner_fcm_tokens      (partner push notifications)
 *
 * Also seeds default languages (en, hi, gu, mr, pa) and their
 * translation_versions rows so the app never crashes on first boot.
 *
 * Safe to run multiple times — every statement uses IF NOT EXISTS /
 * ON DUPLICATE KEY UPDATE so it is fully idempotent.
 */

const mysql = require('mysql2/promise');
const path  = require('path');

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
require('dotenv').config({ path: path.resolve(process.cwd(), envFile) });

const DB_CONFIG = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'linko',
  multipleStatements: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// DDL + seed statements (all idempotent)
// ─────────────────────────────────────────────────────────────────────────────

const STATEMENTS = [

  // ── 1. languages ────────────────────────────────────────────────────────────
  {
    label: 'Create languages table',
    sql: `
      CREATE TABLE IF NOT EXISTS \`languages\` (
        \`id\`          INT AUTO_INCREMENT PRIMARY KEY,
        \`code\`        VARCHAR(10)  UNIQUE NOT NULL COMMENT 'ISO 639-1 code',
        \`name\`        VARCHAR(50)  NOT NULL COMMENT 'English name',
        \`native_name\` VARCHAR(50)  NOT NULL COMMENT 'Native name',
        \`is_active\`   BOOLEAN      DEFAULT TRUE,
        \`sort_order\`  INT          DEFAULT 0,
        \`created_at\`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_code\`   (\`code\`),
        INDEX \`idx_active\` (\`is_active\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
  },

  // ── 2. translations ─────────────────────────────────────────────────────────
  {
    label: 'Create translations table',
    sql: `
      CREATE TABLE IF NOT EXISTS \`translations\` (
        \`id\`                INT AUTO_INCREMENT PRIMARY KEY,
        \`language_code\`     VARCHAR(10)  NOT NULL,
        \`translation_key\`   VARCHAR(100) NOT NULL,
        \`translation_value\` TEXT         NOT NULL,
        \`category\`          VARCHAR(50)  DEFAULT 'general',
        \`created_at\`        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\`        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY \`unique_translation\` (\`language_code\`, \`translation_key\`),
        INDEX \`idx_language\` (\`language_code\`),
        INDEX \`idx_key\`      (\`translation_key\`),
        INDEX \`idx_category\` (\`category\`),
        INDEX \`idx_updated\`  (\`updated_at\`),
        FOREIGN KEY (\`language_code\`) REFERENCES \`languages\`(\`code\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
  },

  // ── 3. translation_versions ─────────────────────────────────────────────────
  {
    label: 'Create translation_versions table',
    sql: `
      CREATE TABLE IF NOT EXISTS \`translation_versions\` (
        \`id\`             INT AUTO_INCREMENT PRIMARY KEY,
        \`language_code\`  VARCHAR(10) NOT NULL,
        \`version\`        VARCHAR(20) NOT NULL DEFAULT '1.0.0',
        \`updated_at\`     TIMESTAMP   DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`updated_by\`     INT         DEFAULT NULL,
        \`change_summary\` TEXT,
        UNIQUE KEY \`unique_language_version\` (\`language_code\`),
        INDEX \`idx_language\` (\`language_code\`),
        FOREIGN KEY (\`language_code\`) REFERENCES \`languages\`(\`code\`)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
  },

  // ── 4. withdrawal_requests ──────────────────────────────────────────────────
  {
    label: 'Create withdrawal_requests table',
    sql: `
      CREATE TABLE IF NOT EXISTS \`withdrawal_requests\` (
        \`id\`               INT AUTO_INCREMENT PRIMARY KEY,
        \`partner_id\`       INT             NOT NULL,
        \`amount\`           DECIMAL(10,2)   NOT NULL,
        \`status\`           ENUM('pending','approved','rejected','completed') DEFAULT 'pending',
        \`request_date\`     TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
        \`processed_date\`   TIMESTAMP       NULL,
        \`processed_by\`     INT             NULL COMMENT 'Admin user ID',
        \`admin_notes\`      TEXT            NULL,
        \`partner_notes\`    TEXT            NULL,
        \`bank_details\`     JSON            NULL,
        \`transaction_id\`   VARCHAR(255)    NULL,
        \`created_at\`       TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\`       TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`deleted_at\`       TIMESTAMP       NULL,
        FOREIGN KEY (\`partner_id\`)   REFERENCES \`partners\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`processed_by\`) REFERENCES \`users\`(\`id\`)    ON DELETE SET NULL,
        INDEX \`idx_partner_id\`   (\`partner_id\`),
        INDEX \`idx_status\`       (\`status\`),
        INDEX \`idx_request_date\` (\`request_date\`),
        INDEX \`idx_deleted_at\`   (\`deleted_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
  },

  // ── 5. user_fcm_tokens ──────────────────────────────────────────────────────
  {
    label: 'Create user_fcm_tokens table',
    sql: `
      CREATE TABLE IF NOT EXISTS \`user_fcm_tokens\` (
        \`id\`          INT(11) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`user_id\`     INT(11)      NOT NULL,
        \`fcm_token\`   VARCHAR(500) NOT NULL,
        \`device_type\` ENUM('ios','android','web') DEFAULT 'android',
        \`device_id\`   VARCHAR(255) DEFAULT NULL,
        \`last_used_at\` TIMESTAMP   NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_at\`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        \`deleted_at\`  TIMESTAMP    NULL DEFAULT NULL,
        UNIQUE KEY \`unique_user_token\` (\`user_id\`, \`fcm_token\`),
        KEY \`idx_user_id\`  (\`user_id\`),
        KEY \`idx_fcm_token\` (\`fcm_token\`(255)),
        CONSTRAINT \`fk_user_fcm_tokens_user_id\`
          FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
  },

  // ── 6. customer_fcm_tokens ──────────────────────────────────────────────────
  {
    label: 'Create customer_fcm_tokens table',
    sql: `
      CREATE TABLE IF NOT EXISTS \`customer_fcm_tokens\` (
        \`id\`           INT(11) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`customer_id\`  INT(11)      NOT NULL,
        \`fcm_token\`    VARCHAR(500) NOT NULL,
        \`device_type\`  ENUM('ios','android','web') DEFAULT 'android',
        \`device_id\`    VARCHAR(255) DEFAULT NULL,
        \`last_used_at\` TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_at\`   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        \`deleted_at\`   TIMESTAMP    NULL DEFAULT NULL,
        UNIQUE KEY \`unique_customer_token\` (\`customer_id\`, \`fcm_token\`),
        KEY \`idx_customer_id\`  (\`customer_id\`),
        KEY \`idx_fcm_token\`    (\`fcm_token\`(255)),
        CONSTRAINT \`fk_customer_fcm_tokens_customer_id\`
          FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
  },

  // ── 7. partner_fcm_tokens ───────────────────────────────────────────────────
  {
    label: 'Create partner_fcm_tokens table',
    sql: `
      CREATE TABLE IF NOT EXISTS \`partner_fcm_tokens\` (
        \`id\`          INT(11) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`partner_id\`  INT(11)      NOT NULL,
        \`fcm_token\`   VARCHAR(500) NOT NULL,
        \`device_type\` ENUM('ios','android','web') DEFAULT 'android',
        \`device_id\`   VARCHAR(255) DEFAULT NULL,
        \`last_used_at\` TIMESTAMP   NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_at\`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        \`deleted_at\`  TIMESTAMP    NULL DEFAULT NULL,
        UNIQUE KEY \`unique_partner_token\` (\`partner_id\`, \`fcm_token\`),
        KEY \`idx_partner_id\`  (\`partner_id\`),
        KEY \`idx_fcm_token\`   (\`fcm_token\`(255)),
        CONSTRAINT \`fk_partner_fcm_tokens_partner_id\`
          FOREIGN KEY (\`partner_id\`) REFERENCES \`partners\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
  },

  // ── 8. Add is_online column to partners ─────────────────────────────────────
  {
    label: 'Add is_online column to partners table',
    sql: `
      ALTER TABLE \`partners\`
      ADD COLUMN IF NOT EXISTS \`is_online\` TINYINT(1) NOT NULL DEFAULT 0
        COMMENT '1 = partner is currently online and accepting jobs'
        AFTER \`last_seen_at\`
    `,
  },

  // ── 9. Seed default languages ────────────────────────────────────────────────
  {
    label: 'Seed default languages (en, hi, gu, mr, pa)',
    sql: `
      INSERT INTO \`languages\` (code, name, native_name, is_active, sort_order) VALUES
        ('en', 'English',   'English',    TRUE, 1),
        ('hi', 'Hindi',     'हिन्दी',      TRUE, 2),
        ('gu', 'Gujarati',  'ગુજરાતી',    TRUE, 3),
        ('mr', 'Marathi',   'मराठी',      TRUE, 4),
        ('pa', 'Punjabi',   'ਪੰਜਾਬੀ',     TRUE, 5)
      ON DUPLICATE KEY UPDATE
        name        = VALUES(name),
        native_name = VALUES(native_name),
        is_active   = VALUES(is_active),
        sort_order  = VALUES(sort_order)
    `,
  },

  // ── 9. Seed translation versions ────────────────────────────────────────────
  {
    label: 'Seed translation_versions for all languages',
    sql: `
      INSERT INTO \`translation_versions\` (language_code, version, change_summary) VALUES
        ('en', '1.0.0', 'Initial English translations'),
        ('hi', '1.0.0', 'Initial Hindi translations'),
        ('gu', '1.0.0', 'Initial Gujarati translations'),
        ('mr', '1.0.0', 'Initial Marathi translations'),
        ('pa', '1.0.0', 'Initial Punjabi translations')
      ON DUPLICATE KEY UPDATE version = VALUES(version)
    `,
  },

  // ── 10. Seed baseline translations ──────────────────────────────────────────
  {
    label: 'Seed baseline translations (app name + welcome + language picker)',
    sql: `
      INSERT INTO \`translations\` (language_code, translation_key, translation_value, category) VALUES
        ('en', 'appName',            'Work Wala',                                    'general'),
        ('en', 'welcomeMessage',     'Welcome to Work Wala',                         'general'),
        ('en', 'chooseYourLanguage', 'Choose Your Language',                         'language'),
        ('en', 'continueButton',     'Continue',                                     'general'),

        ('hi', 'appName',            'वर्क वाला',                                    'general'),
        ('hi', 'welcomeMessage',     'वर्क वाला में आपका स्वागत है',                 'general'),
        ('hi', 'chooseYourLanguage', 'अपनी भाषा चुनें',                              'language'),
        ('hi', 'continueButton',     'जारी रखें',                                    'general'),

        ('gu', 'appName',            'વર્ક વાલા',                                    'general'),
        ('gu', 'welcomeMessage',     'વર્ક વાલામાં આપનું સ્વાગત છે',                'general'),
        ('gu', 'chooseYourLanguage', 'તમારી ભાષા પસંદ કરો',                         'language'),
        ('gu', 'continueButton',     'ચાલુ રાખો',                                    'general'),

        ('mr', 'appName',            'वर्क वाला',                                    'general'),
        ('mr', 'welcomeMessage',     'वर्क वाला मध्ये आपले स्वागत आहे',             'general'),
        ('mr', 'chooseYourLanguage', 'तुमची भाषा निवडा',                             'language'),
        ('mr', 'continueButton',     'सुरू ठेवा',                                    'general'),

        ('pa', 'appName',            'ਵਰਕ ਵਾਲਾ',                                    'general'),
        ('pa', 'welcomeMessage',     'ਵਰਕ ਵਾਲਾ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ',              'general'),
        ('pa', 'chooseYourLanguage', 'ਆਪਣੀ ਭਾਸ਼ਾ ਚੁਣੋ',                            'language'),
        ('pa', 'continueButton',     'ਜਾਰੀ ਰੱਖੋ',                                   'general')
      ON DUPLICATE KEY UPDATE
        translation_value = VALUES(translation_value),
        category          = VALUES(category)
    `,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  let conn;
  try {
    console.log('🚀 migrate_missing_tables: connecting to DB…');
    conn = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected');

    for (const { label, sql } of STATEMENTS) {
      try {
        await conn.query(sql);
        console.log(`   ✅ ${label}`);
      } catch (err) {
        // Duplicate-key / already-exists errors are non-fatal
        if (err.code === 'ER_TABLE_EXISTS_ERROR' || err.errno === 1050) {
          console.log(`   ⏭️  ${label} — table already exists, skipping`);
        } else {
          console.error(`   ❌ ${label}: ${err.message}`);
          throw err; // re-throw unexpected errors so the migration is marked failed
        }
      }
    }

    console.log('\n✅ migrate_missing_tables: all statements executed successfully');
  } catch (err) {
    console.error('\n❌ migrate_missing_tables failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
