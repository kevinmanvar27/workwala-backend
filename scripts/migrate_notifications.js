/**
 * Migration: Notification Management Module
 * Run: node scripts/migrate_notifications.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'workwala',
};

async function migrate() {
  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to MySQL');

    // ─── NOTIFICATION_CATEGORIES ─────────────────────────────────────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS notification_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        color VARCHAR(20) DEFAULT '#6B9BFA',
        is_active TINYINT(1) DEFAULT 1,
        sort_order INT DEFAULT 0,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_slug (slug),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table: notification_categories');

    // ─── SEED DEFAULT NOTIFICATION CATEGORIES ────────────────────────────────
    await connection.query(`
      INSERT IGNORE INTO notification_categories (name, slug, description, color, sort_order) VALUES
        ('General',              'general',              'General announcements and information',   '#6B9BFA', 1),
        ('Promotional',          'promotional',          'Promotional offers and deals',            '#D9A05B', 2),
        ('Offers',               'offers',               'Special offers and discounts',            '#4AC48B', 3),
        ('Updates',              'updates',              'App and service updates',                 '#8B5CF6', 4),
        ('Alerts',               'alerts',               'Important alerts and warnings',           '#C77878', 5),
        ('System Notifications', 'system',               'System-level notifications',              '#757575', 6),
        ('Partner Notifications','partner-notifications','Notifications targeted at partners',      '#2DD4BF', 7),
        ('User Notifications',   'user-notifications',   'Notifications targeted at users',         '#C2185B', 8),
        ('Marketing',            'marketing',            'Marketing campaigns',                     '#FB923C', 9),
        ('Other',                'other',                'Miscellaneous notifications',             '#9CA3AF', 10)
    `);
    console.log('✅ Seeded: notification_categories');

    // ─── PUSH_NOTIFICATIONS ──────────────────────────────────────────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS push_notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        category_id INT NULL,
        image_url VARCHAR(500) NULL,
        action_url VARCHAR(500) NULL,
        -- Audience / targeting (stored as JSON for flexibility)
        audience_type ENUM('all','city','partner','specific_user','category','role','partner_type','custom') DEFAULT 'all',
        audience_filters JSON NULL,
        -- Recipient count (estimated at creation, actual at send)
        estimated_recipients INT DEFAULT 0,
        actual_recipients INT DEFAULT 0,
        delivered_count INT DEFAULT 0,
        failed_count INT DEFAULT 0,
        opened_count INT DEFAULT 0,
        clicked_count INT DEFAULT 0,
        -- Scheduling
        priority ENUM('low','normal','high') DEFAULT 'normal',
        status ENUM('draft','scheduled','sending','sent','failed','cancelled') DEFAULT 'draft',
        scheduled_at TIMESTAMP NULL DEFAULT NULL,
        sent_at TIMESTAMP NULL DEFAULT NULL,
        -- Channels (JSON array for future extensibility: push, in_app, email, sms)
        channels JSON NULL,
        -- Meta
        created_by INT NULL,
        created_by_name VARCHAR(255) NULL,
        notes TEXT NULL,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES notification_categories(id) ON DELETE SET NULL,
        INDEX idx_status (status),
        INDEX idx_scheduled_at (scheduled_at),
        INDEX idx_created_by (created_by),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table: push_notifications');

    // ─── PUSH_NOTIFICATION_LOGS ──────────────────────────────────────────────
    // Per-recipient delivery tracking
    await connection.query(`
      CREATE TABLE IF NOT EXISTS push_notification_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        notification_id INT NOT NULL,
        recipient_type ENUM('user','partner','customer') NOT NULL,
        recipient_id INT NOT NULL,
        recipient_name VARCHAR(255) NULL,
        fcm_token VARCHAR(500) NULL,
        status ENUM('pending','sent','delivered','failed','opened','clicked') DEFAULT 'pending',
        error_message TEXT NULL,
        sent_at TIMESTAMP NULL DEFAULT NULL,
        delivered_at TIMESTAMP NULL DEFAULT NULL,
        opened_at TIMESTAMP NULL DEFAULT NULL,
        clicked_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (notification_id) REFERENCES push_notifications(id) ON DELETE CASCADE,
        INDEX idx_notification_id (notification_id),
        INDEX idx_recipient (recipient_type, recipient_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table: push_notification_logs');

    // ─── NEW PERMISSIONS ─────────────────────────────────────────────────────
    const notifPerms = [
      { name: 'View Notifications',     slug: 'notifications.view',     module: 'notifications' },
      { name: 'Create Notifications',   slug: 'notifications.create',   module: 'notifications' },
      { name: 'Send Notifications',     slug: 'notifications.send',     module: 'notifications' },
      { name: 'Schedule Notifications', slug: 'notifications.schedule', module: 'notifications' },
      { name: 'Cancel Notifications',   slug: 'notifications.cancel',   module: 'notifications' },
      { name: 'Delete Notifications',   slug: 'notifications.delete',   module: 'notifications' },
    ];
    for (const p of notifPerms) {
      await connection.query(
        `INSERT IGNORE INTO permissions (name, slug, module) VALUES (?, ?, ?)`,
        [p.name, p.slug, p.module]
      );
    }
    console.log('✅ Seeded: notification permissions');

    // Grant all notification permissions to super-admin
    const [superAdminRole] = await connection.query(
      `SELECT id FROM roles WHERE slug = 'super-admin' LIMIT 1`
    );
    if (superAdminRole.length > 0) {
      const [newPerms] = await connection.query(
        `SELECT id FROM permissions WHERE module = 'notifications'`
      );
      for (const perm of newPerms) {
        await connection.query(
          `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
          [superAdminRole[0].id, perm.id]
        );
      }
      console.log('✅ Granted notification permissions to super-admin');
    }

    // Grant view/create/send/schedule/cancel to admin role
    const [adminRole] = await connection.query(
      `SELECT id FROM roles WHERE slug = 'admin' LIMIT 1`
    );
    if (adminRole.length > 0) {
      const adminNotifSlugs = [
        'notifications.view', 'notifications.create',
        'notifications.send', 'notifications.schedule', 'notifications.cancel',
      ];
      const [adminPerms] = await connection.query(
        `SELECT id FROM permissions WHERE slug IN (${adminNotifSlugs.map(() => '?').join(',')})`,
        adminNotifSlugs
      );
      for (const perm of adminPerms) {
        await connection.query(
          `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
          [adminRole[0].id, perm.id]
        );
      }
      console.log('✅ Granted notification permissions to admin');
    }

    console.log('\n🎉 Notification module migration completed!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

migrate();
