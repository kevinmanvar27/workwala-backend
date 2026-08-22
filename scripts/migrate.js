const mysql = require('mysql2/promise');
const path = require('path');

// Load the correct env file based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
require('dotenv').config({ path: path.resolve(process.cwd(), envFile) });

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

const DB_NAME = process.env.DB_NAME || 'linko';

async function migrate() {
  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to MySQL');

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE \`${DB_NAME}\``);
    console.log(`✅ Database "${DB_NAME}" ready`);

    // ─── ROLES ───────────────────────────────────────────────────────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        slug VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table: roles');

    // ─── PERMISSIONS ─────────────────────────────────────────────────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL UNIQUE,
        slug VARCHAR(150) NOT NULL UNIQUE,
        module VARCHAR(100) NOT NULL,
        description TEXT,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table: permissions');

    // ─── ROLE_PERMISSIONS ────────────────────────────────────────────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_id INT NOT NULL,
        permission_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_role_perm (role_id, permission_id),
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table: role_permissions');

    // ─── USERS ───────────────────────────────────────────────────────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255),
        avatar VARCHAR(500),
        role_id INT,
        status ENUM('active','inactive','banned') DEFAULT 'active',
        email_verified_at TIMESTAMP NULL DEFAULT NULL,
        google_id VARCHAR(255),
        apple_id VARCHAR(255),
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table: users');

    // ─── PAGES ───────────────────────────────────────────────────────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS pages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        content LONGTEXT,
        meta_title VARCHAR(255),
        meta_description TEXT,
        status ENUM('published','draft') DEFAULT 'draft',
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table: pages');

    // ─── SETTINGS ────────────────────────────────────────────────────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        key_name VARCHAR(255) NOT NULL UNIQUE,
        value LONGTEXT,
        group_name VARCHAR(100) DEFAULT 'general',
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table: settings');

    // ─── PASSWORD_RESETS ─────────────────────────────────────────────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_token (token)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table: password_resets');

    // ─── DELETE_ACCOUNT_REQUESTS ─────────────────────────────────────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS delete_account_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        reason TEXT,
        status ENUM('pending','approved','rejected') DEFAULT 'pending',
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table: delete_account_requests');

    // ─── ACTIVITY_LOGS ───────────────────────────────────────────────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        user_name VARCHAR(255) NOT NULL DEFAULT '',
        action VARCHAR(100) NOT NULL,
        module VARCHAR(100) NOT NULL,
        target_id INT NULL,
        target_name VARCHAR(255) NULL,
        description TEXT NULL,
        ip_address VARCHAR(45) NULL,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_module (module),
        INDEX idx_action (action),
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table: activity_logs');

    // ─── PARTNERS ────────────────────────────────────────────────────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS partners (
        id INT AUTO_INCREMENT PRIMARY KEY,
        phone VARCHAR(15) NOT NULL UNIQUE,
        name VARCHAR(255),
        gender ENUM('Male','Female','Other'),
        language VARCHAR(50),
        categories JSON,
        team_option ENUM('yes','no'),
        vehicle_type VARCHAR(100),
        status ENUM('pending','approved','rejected','banned') DEFAULT 'pending',
        fcm_token VARCHAR(500),
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_phone (phone),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table: partners');

    // ─── PARTNER_OTPS ─────────────────────────────────────────────────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS partner_otps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        phone VARCHAR(15) NOT NULL,
        otp VARCHAR(64) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used TINYINT(1) DEFAULT 0,
        attempts TINYINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_phone (phone),
        INDEX idx_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table: partner_otps');

    // ─── PARTNER_DOCUMENTS ───────────────────────────────────────────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS partner_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        partner_id INT NOT NULL UNIQUE,
        id_front VARCHAR(500),
        id_back VARCHAR(500),
        selfie VARCHAR(500),
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table: partner_documents');

    // ─── PARTNER_BANK_DOCUMENTS ──────────────────────────────────────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS partner_bank_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        partner_id INT NOT NULL UNIQUE,
        document_path VARCHAR(500),
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table: partner_bank_documents');

    // ─── CUSTOMERS ───────────────────────────────────────────────────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        phone VARCHAR(15) NOT NULL UNIQUE,
        name VARCHAR(255),
        email VARCHAR(255),
        avatar_url VARCHAR(500),
        language VARCHAR(50),
        fcm_token VARCHAR(500),
        token_version INT DEFAULT 1,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_phone (phone)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table: customers');

    // ─── CUSTOMER_OTPS ───────────────────────────────────────────────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS customer_otps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        phone VARCHAR(15) NOT NULL,
        otp VARCHAR(64) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used TINYINT(1) DEFAULT 0,
        attempts TINYINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_phone (phone),
        INDEX idx_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table: customer_otps');

    // ─── CATEGORIES ──────────────────────────────────────────────────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        price_per_hour DECIMAL(10,2) NOT NULL DEFAULT 100.00,
        icon_path VARCHAR(500),
        icon_color VARCHAR(50),
        bg_color VARCHAR(20) DEFAULT '#F0F5FF',
        border_color VARCHAR(20) DEFAULT '#6B9BFA',
        is_active TINYINT(1) DEFAULT 1,
        sort_order INT DEFAULT 0,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table: categories');

    // ─── CATEGORIES — add icon columns if they don't exist (idempotent) ──────
    const [catCols] = await connection.query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories'
    `);
    const existingCatCols = catCols.map(r => r.COLUMN_NAME);
    if (!existingCatCols.includes('icon_path')) {
      await connection.query(`ALTER TABLE categories ADD COLUMN icon_path VARCHAR(500) NULL DEFAULT NULL AFTER price_per_hour`);
      console.log('✅ categories: added icon_path');
    }
    if (!existingCatCols.includes('icon_color')) {
      await connection.query(`ALTER TABLE categories ADD COLUMN icon_color VARCHAR(50) NULL DEFAULT NULL AFTER icon_path`);
      console.log('✅ categories: added icon_color');
    }

    // ─── SERVICES ────────────────────────────────────────────────────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS services (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        price_per_hour DECIMAL(10,2) NOT NULL DEFAULT 100.00,
        icon_url VARCHAR(500),
        bg_color VARCHAR(20) DEFAULT '#F0F5FF',
        border_color VARCHAR(20) DEFAULT '#6B9BFA',
        is_active TINYINT(1) DEFAULT 1,
        sort_order INT DEFAULT 0,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table: services');

    // ─── SEED SERVICES ───────────────────────────────────────────────────────
    await connection.query(`
      INSERT IGNORE INTO services (name, slug, price_per_hour, bg_color, border_color, sort_order) VALUES
        ('Loading Unloading', 'loading-unloading', 120.00, '#F0F5FF', '#6B9BFA', 1),
        ('House Keeping',     'house-keeping',     100.00, '#F0FAF4', '#4AC48B', 2),
        ('Bathroom Cleaning', 'bathroom-cleaning',  80.00, '#FFF0F5', '#D677B7', 3),
        ('Cooking',           'cooking',           150.00, '#FFF8EA', '#D9A05B', 4),
        ('Driver',            'driver',            200.00, '#FCF0F0', '#C77878', 5)
    `);
    console.log('✅ Seeded: services');

    // ─── BOOKINGS ────────────────────────────────────────────────────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        partner_id INT NULL,
        service_id INT NOT NULL,
        hours INT NOT NULL DEFAULT 1,
        duration_minutes INT NOT NULL DEFAULT 60,
        price_per_hour DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        address TEXT NOT NULL,
        lat DECIMAL(10,7) NULL,
        lng DECIMAL(10,7) NULL,
        otp_code VARCHAR(64) NULL,
        otp_plaintext VARCHAR(6) NULL,
        status ENUM('finding','matched','in_progress','completed','cancelled') DEFAULT 'finding',
        started_at TIMESTAMP NULL DEFAULT NULL,
        payment_method VARCHAR(20) NULL DEFAULT NULL,
        completed_at TIMESTAMP NULL DEFAULT NULL,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
        FOREIGN KEY (service_id) REFERENCES services(id),
        INDEX idx_status (status),
        INDEX idx_customer_id (customer_id),
        INDEX idx_partner_id (partner_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table: bookings');

    // ─── BOOKINGS — add columns if they don't exist (idempotent) ─────────────
    // These columns were added after the initial migration; ALTER TABLE is safe
    // to run on an existing table because we check information_schema first.
    const [bCols] = await connection.query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings'
    `);
    const existingCols = bCols.map(r => r.COLUMN_NAME);
    if (!existingCols.includes('started_at')) {
      await connection.query(`ALTER TABLE bookings ADD COLUMN started_at TIMESTAMP NULL DEFAULT NULL AFTER status`);
      console.log('✅ bookings: added started_at');
    }
    if (!existingCols.includes('payment_method')) {
      await connection.query(`ALTER TABLE bookings ADD COLUMN payment_method VARCHAR(20) NULL DEFAULT NULL AFTER started_at`);
      console.log('✅ bookings: added payment_method');
    }
    if (!existingCols.includes('completed_at')) {
      await connection.query(`ALTER TABLE bookings ADD COLUMN completed_at TIMESTAMP NULL DEFAULT NULL AFTER payment_method`);
      console.log('✅ bookings: added completed_at');
    }

    // ─── PARTNERS — add rating / total_reviews columns if missing ─────────────
    const [pCols] = await connection.query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'partners'
    `);
    const existingPartnerCols = pCols.map(r => r.COLUMN_NAME);
    if (!existingPartnerCols.includes('rating')) {
      await connection.query(`ALTER TABLE partners ADD COLUMN rating DECIMAL(3,2) NULL DEFAULT NULL AFTER status`);
      console.log('✅ partners: added rating');
    }
    if (!existingPartnerCols.includes('total_reviews')) {
      await connection.query(`ALTER TABLE partners ADD COLUMN total_reviews INT NOT NULL DEFAULT 0 AFTER rating`);
      console.log('✅ partners: added total_reviews');
    }
    if (!existingPartnerCols.includes('balance')) {
      await connection.query(`ALTER TABLE partners ADD COLUMN balance DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER total_reviews`);
      console.log('✅ partners: added balance');
    }

    // ─── CUSTOMERS — add wallet_balance column if missing ─────────────────────
    const [custCols] = await connection.query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers'
    `);
    const existingCustCols = custCols.map(r => r.COLUMN_NAME);
    if (!existingCustCols.includes('wallet_balance')) {
      await connection.query(`ALTER TABLE customers ADD COLUMN wallet_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER language`);
      console.log('✅ customers: added wallet_balance');
    }
    if (!existingCustCols.includes('email')) {
      await connection.query(`ALTER TABLE customers ADD COLUMN email VARCHAR(255) NULL DEFAULT NULL AFTER name`);
      console.log('✅ customers: added email');
    }
    if (!existingCustCols.includes('token_version')) {
      await connection.query(`ALTER TABLE customers ADD COLUMN token_version INT NOT NULL DEFAULT 1 AFTER fcm_token`);
      console.log('✅ customers: added token_version');
    }

    // ─── BOOKINGS — add razorpay columns if missing ───────────────────────────
    const [bCols2] = await connection.query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings'
    `);
    const existingBCols2 = bCols2.map(r => r.COLUMN_NAME);
    if (!existingBCols2.includes('razorpay_order_id')) {
      await connection.query(`ALTER TABLE bookings ADD COLUMN razorpay_order_id VARCHAR(100) NULL DEFAULT NULL AFTER completed_at`);
      console.log('✅ bookings: added razorpay_order_id');
    }
    if (!existingBCols2.includes('razorpay_payment_id')) {
      await connection.query(`ALTER TABLE bookings ADD COLUMN razorpay_payment_id VARCHAR(100) NULL DEFAULT NULL AFTER razorpay_order_id`);
      console.log('✅ bookings: added razorpay_payment_id');
    }

    // ─── REVIEWS ─────────────────────────────────────────────────────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL,
        customer_id INT NOT NULL,
        partner_id INT NOT NULL,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT NULL,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_booking_id (booking_id),
        INDEX idx_customer_id (customer_id),
        INDEX idx_partner_id (partner_id),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
        FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table: reviews');

    console.log('\n🎉 Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

migrate();
