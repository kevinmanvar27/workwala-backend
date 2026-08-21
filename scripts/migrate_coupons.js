const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'linko',
};

async function migrate() {
  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to MySQL');

    // ─── COUPONS ─────────────────────────────────────────────────────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id                    INT AUTO_INCREMENT PRIMARY KEY,
        code                  VARCHAR(50)  NOT NULL UNIQUE,
        name                  VARCHAR(255) NOT NULL,
        description           TEXT,
        terms_conditions      TEXT,

        -- Discount
        discount_type         ENUM('percentage','fixed') NOT NULL DEFAULT 'percentage',
        discount_value        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        min_order_value       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        max_discount_amount   DECIMAL(10,2) NULL,

        -- Usage limits
        max_total_usage       INT NULL COMMENT 'NULL = unlimited',
        max_usage_per_user    INT NOT NULL DEFAULT 1,
        current_usage         INT NOT NULL DEFAULT 0,
        once_per_order        TINYINT(1) NOT NULL DEFAULT 1,
        combinable            TINYINT(1) NOT NULL DEFAULT 0,

        -- Scheduling
        starts_at             DATETIME NOT NULL,
        expires_at            DATETIME NOT NULL,
        status                ENUM('draft','scheduled','active','expired','deactivated','exhausted')
                              NOT NULL DEFAULT 'draft',

        -- Applicability (stored as JSON arrays of IDs; NULL = all)
        applicable_categories JSON NULL COMMENT 'Array of category IDs, NULL = all',
        applicable_partners   JSON NULL COMMENT 'Array of partner IDs, NULL = all',
        applicable_cities     JSON NULL COMMENT 'Array of city strings, NULL = all',
        applicable_services   JSON NULL COMMENT 'Array of service IDs, NULL = all',

        -- Target audience filters (JSON object)
        audience_type         ENUM('all','specific_users','city','partner','user_type','new_users','existing_users','first_time') NOT NULL DEFAULT 'all',
        audience_filters      JSON NULL COMMENT 'Flexible filter payload',

        -- Estimated eligible users (cached on save)
        estimated_users       INT NULL DEFAULT NULL,

        -- Meta
        created_by            INT NULL,
        created_by_name       VARCHAR(255) NOT NULL DEFAULT '',
        deleted_at            TIMESTAMP NULL DEFAULT NULL,
        created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        INDEX idx_code        (code),
        INDEX idx_status      (status),
        INDEX idx_starts_at   (starts_at),
        INDEX idx_expires_at  (expires_at),
        INDEX idx_created_by  (created_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table: coupons');

    // ─── COUPON_USER_ELIGIBILITY ──────────────────────────────────────────────
    // When audience_type = 'specific_users', the eligible user IDs are stored here
    await connection.query(`
      CREATE TABLE IF NOT EXISTS coupon_user_eligibility (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        coupon_id   INT NOT NULL,
        customer_id INT NOT NULL,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_coupon_customer (coupon_id, customer_id),
        FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table: coupon_user_eligibility');

    // ─── COUPON_USAGES ────────────────────────────────────────────────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS coupon_usages (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        coupon_id       INT NOT NULL,
        coupon_code     VARCHAR(50) NOT NULL,
        customer_id     INT NULL,
        customer_name   VARCHAR(255) NOT NULL DEFAULT '',
        customer_phone  VARCHAR(20)  NOT NULL DEFAULT '',
        order_id        INT NULL,
        order_amount    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        partner_id      INT NULL,
        partner_name    VARCHAR(255) NULL,
        city            VARCHAR(100) NULL,
        usage_status    ENUM('applied','reversed','failed') NOT NULL DEFAULT 'applied',
        used_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_coupon_id   (coupon_id),
        INDEX idx_customer_id (customer_id),
        INDEX idx_order_id    (order_id),
        INDEX idx_used_at     (used_at),
        FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table: coupon_usages');

    // ─── COUPON_AUDIT_LOGS ────────────────────────────────────────────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS coupon_audit_logs (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        coupon_id    INT NOT NULL,
        coupon_code  VARCHAR(50) NOT NULL,
        action       VARCHAR(100) NOT NULL COMMENT 'created|updated|activated|scheduled|deactivated|expired|used|config_changed',
        performed_by INT NULL,
        performed_by_name VARCHAR(255) NOT NULL DEFAULT '',
        changes      JSON NULL COMMENT 'Before/after snapshot for updates',
        ip_address   VARCHAR(45) NULL,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_coupon_id  (coupon_id),
        INDEX idx_action     (action),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table: coupon_audit_logs');

    // ─── COUPON PERMISSIONS ───────────────────────────────────────────────────
    // Insert coupon-related permissions (INSERT IGNORE = safe to re-run)
    const couponPerms = [
      ['Coupons View',       'coupons.view',       'coupons', 'View coupon list and details'],
      ['Coupons Create',     'coupons.create',     'coupons', 'Create new coupons'],
      ['Coupons Edit',       'coupons.edit',       'coupons', 'Edit existing coupons'],
      ['Coupons Activate',   'coupons.activate',   'coupons', 'Activate or schedule coupons'],
      ['Coupons Deactivate', 'coupons.deactivate', 'coupons', 'Deactivate active coupons'],
      ['Coupons Delete',     'coupons.delete',     'coupons', 'Delete/cancel coupons'],
      ['Coupons Usage View', 'coupons.usage',      'coupons', 'View coupon usage history and reports'],
    ];

    for (const [name, slug, module, description] of couponPerms) {
      await connection.query(
        `INSERT IGNORE INTO permissions (name, slug, module, description) VALUES (?, ?, ?, ?)`,
        [name, slug, module, description]
      );
    }
    console.log('✅ Seeded: coupon permissions');

    console.log('\n🎉 Coupon migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

migrate();
