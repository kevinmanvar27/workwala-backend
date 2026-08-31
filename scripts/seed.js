const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'linko',
};

async function seed() {
  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to MySQL');

    // ─── ROLES ───────────────────────────────────────────────────────────────
    const roles = [
      { name: 'Super Admin', slug: 'super-admin', description: 'Full access to everything' },
      { name: 'Admin', slug: 'admin', description: 'Administrative access' },
      { name: 'Editor', slug: 'editor', description: 'Can manage content' },
      { name: 'User', slug: 'user', description: 'Regular user' },
    ];
    for (const role of roles) {
      await connection.query(
        `INSERT IGNORE INTO roles (name, slug, description) VALUES (?, ?, ?)`,
        [role.name, role.slug, role.description]
      );
    }
    console.log('✅ Seeded: roles');

    // ─── PERMISSIONS ─────────────────────────────────────────────────────────
    const permissions = [
      // Dashboard
      { name: 'View Dashboard', slug: 'dashboard.view', module: 'dashboard' },
      // Users
      { name: 'View Users', slug: 'users.view', module: 'users' },
      { name: 'Create Users', slug: 'users.create', module: 'users' },
      { name: 'Edit Users', slug: 'users.edit', module: 'users' },
      { name: 'Delete Users', slug: 'users.delete', module: 'users' },
      // Roles
      { name: 'View Roles', slug: 'roles.view', module: 'roles' },
      { name: 'Create Roles', slug: 'roles.create', module: 'roles' },
      { name: 'Edit Roles', slug: 'roles.edit', module: 'roles' },
      { name: 'Delete Roles', slug: 'roles.delete', module: 'roles' },
      // Permissions
      { name: 'View Permissions', slug: 'permissions.view', module: 'permissions' },
      { name: 'Assign Permissions', slug: 'permissions.assign', module: 'permissions' },
      // Pages
      { name: 'View Pages', slug: 'pages.view', module: 'pages' },
      { name: 'Create Pages', slug: 'pages.create', module: 'pages' },
      { name: 'Edit Pages', slug: 'pages.edit', module: 'pages' },
      { name: 'Delete Pages', slug: 'pages.delete', module: 'pages' },
      // Settings
      { name: 'View Settings', slug: 'settings.view', module: 'settings' },
      { name: 'Edit Settings', slug: 'settings.edit', module: 'settings' },
      // Activity Logs
      { name: 'View Activity Logs', slug: 'activity_logs.view', module: 'activity_logs' },
      { name: 'Delete Activity Logs', slug: 'activity_logs.delete', module: 'activity_logs' },
      // Notifications
      { name: 'View Notifications',     slug: 'notifications.view',     module: 'notifications' },
      { name: 'Create Notifications',   slug: 'notifications.create',   module: 'notifications' },
      { name: 'Send Notifications',     slug: 'notifications.send',     module: 'notifications' },
      { name: 'Schedule Notifications', slug: 'notifications.schedule', module: 'notifications' },
      { name: 'Cancel Notifications',   slug: 'notifications.cancel',   module: 'notifications' },
      { name: 'Delete Notifications',   slug: 'notifications.delete',   module: 'notifications' },
    ];
    for (const perm of permissions) {
      await connection.query(
        `INSERT IGNORE INTO permissions (name, slug, module) VALUES (?, ?, ?)`,
        [perm.name, perm.slug, perm.module]
      );
    }
    console.log('✅ Seeded: permissions');

    // ─── ROLE PERMISSIONS ────────────────────────────────────────────────────
    const [allPerms] = await connection.query(`SELECT id FROM permissions WHERE deleted_at IS NULL`);
    const [superAdminRole] = await connection.query(`SELECT id FROM roles WHERE slug = 'super-admin'`);
    const [adminRole] = await connection.query(`SELECT id FROM roles WHERE slug = 'admin'`);
    const [editorRole] = await connection.query(`SELECT id FROM roles WHERE slug = 'editor'`);

    // Super Admin gets all permissions
    for (const perm of allPerms) {
      await connection.query(
        `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
        [superAdminRole[0].id, perm.id]
      );
    }

    // Admin gets most permissions except role/permission management
    const adminPermSlugs = [
      'dashboard.view', 'users.view', 'users.create', 'users.edit', 'users.delete',
      'pages.view', 'pages.create', 'pages.edit', 'pages.delete',
      'settings.view', 'settings.edit', 'roles.view', 'permissions.view',
      'activity_logs.view', 'activity_logs.delete',
    ];
    const [adminPerms] = await connection.query(
      `SELECT id FROM permissions WHERE slug IN (${adminPermSlugs.map(() => '?').join(',')})`,
      adminPermSlugs
    );
    for (const perm of adminPerms) {
      await connection.query(
        `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
        [adminRole[0].id, perm.id]
      );
    }

    // Editor gets page and dashboard permissions
    const editorPermSlugs = ['dashboard.view', 'pages.view', 'pages.create', 'pages.edit'];
    const [editorPerms] = await connection.query(
      `SELECT id FROM permissions WHERE slug IN (${editorPermSlugs.map(() => '?').join(',')})`,
      editorPermSlugs
    );
    for (const perm of editorPerms) {
      await connection.query(
        `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
        [editorRole[0].id, perm.id]
      );
    }
    console.log('✅ Seeded: role_permissions');

    // ─── USERS ───────────────────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash('Admin@123', 12);
    await connection.query(
      `INSERT IGNORE INTO users (name, email, password, role_id, status, email_verified_at) VALUES (?, ?, ?, ?, 'active', NOW())`,
      ['Super Admin', 'admin@example.com', hashedPassword, superAdminRole[0].id]
    );
    console.log('✅ Seeded: users (admin@example.com / Admin@123)');

    // ─── PAGES ───────────────────────────────────────────────────────────────
    const pages = [
      {
        title: 'About Us',
        slug: 'about-us',
        content: '<h1>About Us</h1><p>Welcome to our platform. We are dedicated to providing the best service possible.</p>',
        meta_title: 'About Us',
        meta_description: 'Learn more about our company and mission.',
        status: 'published',
      },
      {
        title: 'Privacy Policy',
        slug: 'privacy-policy',
        content: '<h1>Privacy Policy</h1><p>Your privacy is important to us. This policy explains how we collect and use your data.</p>',
        meta_title: 'Privacy Policy',
        meta_description: 'Read our privacy policy.',
        status: 'published',
      },
      {
        title: 'Terms of Service',
        slug: 'terms-of-service',
        content: '<h1>Terms of Service</h1><p>By using our service, you agree to these terms and conditions.</p>',
        meta_title: 'Terms of Service',
        meta_description: 'Read our terms of service.',
        status: 'published',
      },
    ];
    for (const page of pages) {
      await connection.query(
        `INSERT IGNORE INTO pages (title, slug, content, meta_title, meta_description, status) VALUES (?, ?, ?, ?, ?, ?)`,
        [page.title, page.slug, page.content, page.meta_title, page.meta_description, page.status]
      );
    }
    console.log('✅ Seeded: pages');

    // ─── SETTINGS ────────────────────────────────────────────────────────────
    const settings = [
      // General
      { key_name: 'site_name', value: 'Linko', group_name: 'general' },
      { key_name: 'site_tagline', value: 'Build something amazing', group_name: 'general' },
      { key_name: 'site_logo', value: '', group_name: 'general' },
      { key_name: 'contact_support_email', value: 'support@example.com', group_name: 'general' },
      { key_name: 'business_email', value: 'business@example.com', group_name: 'general' },
      { key_name: 'contact_phone', value: '', group_name: 'general' },
      { key_name: 'address', value: '', group_name: 'general' },
      // Social
      { key_name: 'social_facebook', value: '', group_name: 'social' },
      { key_name: 'social_twitter', value: '', group_name: 'social' },
      { key_name: 'social_instagram', value: '', group_name: 'social' },
      { key_name: 'social_linkedin', value: '', group_name: 'social' },
      { key_name: 'social_youtube', value: '', group_name: 'social' },
      // Auth
      { key_name: 'google_login_enabled', value: '0', group_name: 'auth' },
      { key_name: 'google_client_id', value: '', group_name: 'auth' },
      { key_name: 'google_client_secret', value: '', group_name: 'auth' },
      { key_name: 'apple_login_enabled', value: '0', group_name: 'auth' },
      { key_name: 'apple_client_id', value: '', group_name: 'auth' },
      { key_name: 'apple_client_secret', value: '', group_name: 'auth' },
      // Payment
      { key_name: 'razorpay_mode', value: 'test', group_name: 'payment' },
      { key_name: 'razorpay_key_id_test', value: '', group_name: 'payment' },
      { key_name: 'razorpay_key_secret_test', value: '', group_name: 'payment' },
      { key_name: 'razorpay_key_id_live', value: '', group_name: 'payment' },
      { key_name: 'razorpay_key_secret_live', value: '', group_name: 'payment' },
      // Mail
      { key_name: 'mail_host', value: 'smtp.gmail.com', group_name: 'mail' },
      { key_name: 'mail_port', value: '587', group_name: 'mail' },
      { key_name: 'mail_username', value: '', group_name: 'mail' },
      { key_name: 'mail_password', value: '', group_name: 'mail' },
      { key_name: 'mail_from_address', value: '', group_name: 'mail' },
      { key_name: 'mail_from_name', value: 'Linko', group_name: 'mail' },
      { key_name: 'mail_encryption', value: 'tls', group_name: 'mail' },
      // Notifications
      { key_name: 'push_notifications_enabled', value: '0', group_name: 'notifications' },
      { key_name: 'notify_new_user',             value: '1', group_name: 'notifications' },
      { key_name: 'notify_login',                value: '0', group_name: 'notifications' },
      { key_name: 'notify_delete_request',       value: '1', group_name: 'notifications' },
      { key_name: 'notify_payment',              value: '1', group_name: 'notifications' },
      { key_name: 'notify_new_booking',          value: '1', group_name: 'notifications' },
      { key_name: 'notify_booking_accepted',     value: '1', group_name: 'notifications' },
      { key_name: 'notify_booking_completed',    value: '1', group_name: 'notifications' },
      { key_name: 'notify_withdrawal',           value: '1', group_name: 'notifications' },
      { key_name: 'notify_booking_cancelled',    value: '1', group_name: 'notifications' },
      { key_name: 'fcm_project_id',              value: '', group_name: 'notifications' },
      { key_name: 'fcm_client_email',            value: '', group_name: 'notifications' },
      { key_name: 'fcm_private_key',             value: '', group_name: 'notifications' },
    ];
    for (const setting of settings) {
      await connection.query(
        `INSERT IGNORE INTO settings (key_name, value, group_name) VALUES (?, ?, ?)`,
        [setting.key_name, setting.value, setting.group_name]
      );
    }
    console.log('✅ Seeded: settings');

    console.log('\n🎉 Seeding completed successfully!');
    console.log('📧 Admin Login: admin@example.com');
    console.log('🔑 Password: Admin@123');
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

seed();
