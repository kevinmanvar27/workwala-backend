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
        title: 'Help & Support',
        slug: 'help-and-support',
        content: `<h1>Help &amp; Support</h1>
<p>Welcome to our Help &amp; Support centre. We're here to make sure your experience with Linko is smooth and hassle-free.</p>

<h2>Getting Started</h2>
<p>New to Linko? Here's how it works:</p>
<ol>
  <li>Create your account using your mobile number and OTP.</li>
  <li>Browse available services and choose what you need.</li>
  <li>Book a partner and track them in real time.</li>
  <li>Pay securely via UPI, card, or cash on completion.</li>
</ol>

<h2>Booking Issues</h2>
<p>If you face any issue with a booking, here's what you can do:</p>
<ul>
  <li><strong>Partner not arrived:</strong> Check the live tracking on the booking screen. If the partner is unreachable, you can cancel the booking.</li>
  <li><strong>Service quality concern:</strong> Rate your experience after the job is complete. Our team reviews all low ratings.</li>
  <li><strong>Wrong charge:</strong> The final amount is confirmed before payment. If you believe there's an error, contact us immediately.</li>
</ul>

<h2>Payments &amp; Refunds</h2>
<ul>
  <li><strong>Accepted methods:</strong> UPI, debit/credit card, net banking, and cash.</li>
  <li><strong>Refunds:</strong> If a booking is cancelled before the partner arrives, any online payment is refunded within 5–7 business days.</li>
  <li><strong>Receipts:</strong> A digital receipt is sent to your registered number after every completed booking.</li>
</ul>

<h2>Account &amp; Security</h2>
<ul>
  <li><strong>Change phone number:</strong> Contact support — we'll verify your identity before updating.</li>
  <li><strong>Forgot OTP:</strong> Tap "Resend OTP" on the login screen. OTPs expire after 10 minutes.</li>
  <li><strong>Suspicious activity:</strong> If you notice any unauthorised activity, contact us immediately and we'll secure your account.</li>
</ul>

<h2>Contact Us</h2>
<p>Still need help? Reach out to our support team:</p>
<ul>
  <li><strong>Email:</strong> support@joinlinko.com</li>
  <li><strong>Response time:</strong> We typically respond within 24 hours on business days.</li>
</ul>`,
        meta_title: 'Help & Support – Linko',
        meta_description: 'Get help with bookings, payments, account issues and more on the Linko platform.',
        status: 'published',
      },
      {
        title: 'About',
        slug: 'about',
        content: `<h1>About Linko</h1>
<p>Linko is a hyperlocal home-services platform that connects customers with skilled, verified service partners — quickly, safely, and affordably.</p>

<h2>Our Mission</h2>
<p>We believe everyone deserves access to reliable home services without the hassle of searching, negotiating, or worrying about quality. Linko makes it as simple as a few taps.</p>

<h2>What We Offer</h2>
<ul>
  <li><strong>Verified Partners:</strong> Every partner on Linko goes through identity verification and skill assessment before they can accept bookings.</li>
  <li><strong>Real-Time Tracking:</strong> Know exactly where your partner is from the moment they accept your booking.</li>
  <li><strong>Transparent Pricing:</strong> No hidden charges. You see the full price before you confirm.</li>
  <li><strong>Flexible Payments:</strong> Pay via UPI, card, or cash — whichever is convenient for you.</li>
</ul>

<h2>For Partners</h2>
<p>Linko empowers skilled professionals to grow their income on their own schedule. Partners get:</p>
<ul>
  <li>A steady stream of nearby job requests.</li>
  <li>Instant digital payments directly to their wallet.</li>
  <li>Ratings and reviews that help build their reputation.</li>
  <li>Full control over their availability and team preferences.</li>
</ul>

<h2>Our Values</h2>
<ul>
  <li><strong>Trust:</strong> Safety and verification are at the core of every interaction.</li>
  <li><strong>Simplicity:</strong> Technology should make life easier, not harder.</li>
  <li><strong>Fairness:</strong> Transparent pricing and fair earnings for partners.</li>
  <li><strong>Community:</strong> Building livelihoods while serving neighbourhoods.</li>
</ul>

<h2>Get in Touch</h2>
<p>We'd love to hear from you — whether you're a customer, a partner, or just curious about what we're building.</p>
<ul>
  <li><strong>Email:</strong> hello@joinlinko.com</li>
  <li><strong>Website:</strong> joinlinko.com</li>
</ul>`,
        meta_title: 'About Linko – Hyperlocal Home Services',
        meta_description: 'Learn about Linko, our mission, what we offer, and how we connect customers with verified service partners.',
        status: 'published',
      },
      {
        title: 'About Us',
        slug: 'about-us',
        content: '<h1>About Us</h1><p>Welcome to our platform. We are dedicated to providing the best service possible.</p>',
        meta_title: 'About Us',
        meta_description: 'Learn more about our company and mission.',
        status: 'draft',
      },
      {
        title: 'Privacy Policy',
        slug: 'privacy-policy',
        content: `<h1>Privacy Policy</h1>
<p>Your privacy is important to us. This policy explains how we collect, use, and protect your personal data when you use the Linko platform.</p>

<h2>Information We Collect</h2>
<ul>
  <li><strong>Account data:</strong> Mobile number, name, and profile details you provide during registration.</li>
  <li><strong>Location data:</strong> Real-time location while a booking is active, used to match you with nearby partners.</li>
  <li><strong>Usage data:</strong> Booking history, app interactions, and device information for service improvement.</li>
  <li><strong>Payment data:</strong> Transaction references (we do not store full card numbers — payments are processed by Razorpay).</li>
</ul>

<h2>How We Use Your Data</h2>
<ul>
  <li>To process and fulfil your bookings.</li>
  <li>To send OTPs, booking confirmations, and service updates via SMS/push notifications.</li>
  <li>To improve platform safety, detect fraud, and resolve disputes.</li>
  <li>To comply with applicable laws and regulations.</li>
</ul>

<h2>Data Sharing</h2>
<p>We do not sell your personal data. We share data only with:</p>
<ul>
  <li>Service partners — limited to what is needed to fulfil your booking (name, contact, location).</li>
  <li>Payment processors (Razorpay) for transaction handling.</li>
  <li>Government or law-enforcement agencies when legally required.</li>
</ul>

<h2>Data Retention</h2>
<p>We retain your data for as long as your account is active or as required by law. You may request deletion of your account and associated data by contacting support.</p>

<h2>Your Rights</h2>
<ul>
  <li>Access, correct, or delete your personal data.</li>
  <li>Withdraw consent for non-essential data processing.</li>
  <li>Lodge a complaint with the relevant data-protection authority.</li>
</ul>

<h2>Contact</h2>
<p>For privacy-related queries, email us at <strong>privacy@joinlinko.com</strong>.</p>`,
        meta_title: 'Privacy Policy – Linko',
        meta_description: 'Read our privacy policy to understand how Linko collects, uses, and protects your personal data.',
        status: 'published',
      },
      {
        title: 'Terms of Service',
        slug: 'terms-of-service',
        content: `<h1>Terms of Service</h1>
<p>By accessing or using the Linko platform (app or website), you agree to be bound by these Terms of Service. Please read them carefully.</p>

<h2>1. Eligibility</h2>
<p>You must be at least 18 years old and capable of entering into a legally binding agreement to use Linko.</p>

<h2>2. Services</h2>
<p>Linko is a technology platform that connects customers with independent service partners. Linko does not itself provide home services — it facilitates the connection between customers and partners.</p>

<h2>3. Bookings &amp; Payments</h2>
<ul>
  <li>Prices are displayed before confirmation. You agree to pay the stated amount upon booking.</li>
  <li>Payments are processed securely via Razorpay. Linko does not store card details.</li>
  <li>Cancellations before partner arrival may be eligible for a full refund; cancellations after arrival may incur a fee.</li>
</ul>

<h2>4. User Conduct</h2>
<p>You agree not to:</p>
<ul>
  <li>Use the platform for any unlawful purpose.</li>
  <li>Harass, threaten, or abuse service partners or other users.</li>
  <li>Attempt to circumvent the platform to arrange off-platform payments.</li>
  <li>Provide false information during registration or booking.</li>
</ul>

<h2>5. Partner Conduct</h2>
<p>Partners are independent contractors, not employees of Linko. Partners are responsible for the quality of their work and must comply with all applicable laws.</p>

<h2>6. Limitation of Liability</h2>
<p>Linko's liability is limited to the amount paid for the specific booking in dispute. We are not liable for indirect, incidental, or consequential damages.</p>

<h2>7. Changes to Terms</h2>
<p>We may update these terms from time to time. Continued use of the platform after changes constitutes acceptance of the new terms.</p>

<h2>8. Contact</h2>
<p>For questions about these terms, contact us at <strong>legal@joinlinko.com</strong>.</p>`,
        meta_title: 'Terms of Service – Linko',
        meta_description: 'Read the Linko terms of service governing use of our platform by customers and service partners.',
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
