/**
 * Migration: Seed Default Pages
 *
 * Ensures all 5 required pages exist in the `pages` table:
 *   1. Help & Support   (help-and-support)   — published
 *   2. About            (about)              — published
 *   3. About Us         (about-us)           — draft
 *   4. Privacy Policy   (privacy-policy)     — published
 *   5. Terms of Service (terms-of-service)   — published
 *
 * Safe to run multiple times — uses INSERT IGNORE so existing rows
 * (including any admin edits) are never overwritten.
 */

const mysql = require('mysql2/promise');
const path  = require('path');
const fs = require('fs');

// Load environment variables
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
const envPath = path.resolve(process.cwd(), envFile);

// Only load .env file if it exists (production might use environment variables directly)
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  // In production on Hostinger, environment variables are set directly
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
}

const DB_CONFIG = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'workwala',
};

// ── Page definitions ──────────────────────────────────────────────────────────
const PAGES = [
  {
    title: 'Help & Support',
    slug:  'help-and-support',
    status: 'published',
    meta_title: 'Help & Support – Linko',
    meta_description: 'Get help with bookings, payments, account issues and more on the Linko platform.',
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
  },
  {
    title: 'About',
    slug:  'about',
    status: 'published',
    meta_title: 'About Linko – Hyperlocal Home Services',
    meta_description: 'Learn about Linko, our mission, what we offer, and how we connect customers with verified service partners.',
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
  },
  {
    title: 'About Us',
    slug:  'about-us',
    status: 'draft',
    meta_title: 'About Us',
    meta_description: 'Learn more about our company and mission.',
    content: '<h1>About Us</h1><p>Welcome to our platform. We are dedicated to providing the best service possible.</p>',
  },
  {
    title: 'Privacy Policy',
    slug:  'privacy-policy',
    status: 'published',
    meta_title: 'Privacy Policy – Linko',
    meta_description: 'Read our privacy policy to understand how Linko collects, uses, and protects your personal data.',
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
  },
  {
    title: 'Terms of Service',
    slug:  'terms-of-service',
    status: 'published',
    meta_title: 'Terms of Service – Linko',
    meta_description: 'Read the Linko terms of service governing use of our platform by customers and service partners.',
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
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────
async function run() {
  let conn;
  try {
    console.log('🚀 migrate_seed_pages: connecting to DB…');
    conn = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected');

    // Ensure pages table exists (idempotent — matches migrate.js definition)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS pages (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        title            VARCHAR(255) NOT NULL,
        slug             VARCHAR(255) NOT NULL UNIQUE,
        content          LONGTEXT,
        meta_title       VARCHAR(255),
        meta_description TEXT,
        status           ENUM('published','draft') DEFAULT 'draft',
        deleted_at       TIMESTAMP NULL DEFAULT NULL,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✅ Table: pages (ensured)');

    // Seed each page — INSERT IGNORE means existing rows are never touched
    for (const page of PAGES) {
      await conn.query(
        `INSERT IGNORE INTO pages (title, slug, content, meta_title, meta_description, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [page.title, page.slug, page.content, page.meta_title, page.meta_description, page.status]
      );
      console.log(`   ✅ Page seeded (or already exists): ${page.slug}`);
    }

    console.log('\n✅ migrate_seed_pages: all pages seeded successfully');
  } catch (err) {
    console.error('\n❌ migrate_seed_pages failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
