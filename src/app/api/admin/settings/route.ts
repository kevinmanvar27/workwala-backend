import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { logActivity, getClientIp } from '@/lib/activityLogger';

// Canonical group for every known key — single source of truth used by both GET and POST
const KEY_GROUPS: Record<string, string> = {
  site_name: 'general', site_tagline: 'general', site_logo: 'general', site_favicon: 'general',
  site_url: 'general', copyright_text: 'general',
  contact_support_email: 'general', business_email: 'general',
  contact_phone: 'general', address: 'general',
  meta_title: 'general', meta_description: 'general', meta_keywords: 'general',
  meta_author: 'general', meta_og_image: 'general', og_title: 'general', og_description: 'general',
  social_facebook: 'social', social_twitter: 'social', social_instagram: 'social',
  social_linkedin: 'social', social_youtube: 'social',
  manual_login_enabled: 'auth',
  google_login_enabled: 'auth', google_client_id: 'auth', google_client_secret: 'auth',
  apple_login_enabled: 'auth', apple_client_id: 'auth', apple_client_secret: 'auth',
  razorpay_mode: 'payment', razorpay_key_id_test: 'payment',
  razorpay_key_secret_test: 'payment', razorpay_key_id_live: 'payment',
  razorpay_key_secret_live: 'payment',
  partner_minimum_wallet_balance: 'wallet',
  partner_platform_fee_type: 'wallet',
  partner_platform_fee_value: 'wallet',
  partner_task_fee: 'wallet',
  mail_host: 'mail', mail_port: 'mail', mail_username: 'mail',
  mail_password: 'mail', mail_from_address: 'mail', mail_from_name: 'mail',
  mail_encryption: 'mail',
  ga_script: 'analytics',
  color_primary: 'appearance', color_accent: 'appearance', color_sidebar: 'appearance',
  push_notifications_enabled: 'notifications',
  notify_new_user:            'notifications',
  notify_login:               'notifications',
  notify_delete_request:      'notifications',
  notify_payment:             'notifications',
  notify_new_booking:         'notifications',
  notify_booking_accepted:    'notifications',
  notify_booking_completed:   'notifications',
  notify_withdrawal:          'notifications',
  notify_booking_cancelled:   'notifications',
  fcm_project_id:             'notifications',
  fcm_client_email:           'notifications',
  fcm_private_key:            'notifications',
  // App Links
  playstore_partner_url:      'app_links',
  playstore_customer_url:     'app_links',
  appstore_partner_url:       'app_links',
  appstore_customer_url:      'app_links',
  // SMS / OTP (MSG91)
  msg91_auth_key:             'sms',
  msg91_template_id:          'sms',
  msg91_sender_id:            'sms',
  msg91_otp_expiry_minutes:   'sms',
};

// Keys whose values must be masked in GET responses to prevent secret leakage
// via the admin panel UI or API inspection tools.
const MASKED_KEYS = new Set([
  'fcm_private_key',
  'razorpay_key_secret_test',
  'razorpay_key_secret_live',
  'mail_password',
  'google_client_secret',
  'apple_client_secret',
  'msg91_auth_key',
]);

const MASK_VALUE = '••••••••';

// Max file size for logo/favicon uploads: 2 MB
const MAX_LOGO_SIZE = 2 * 1024 * 1024;

/**
 * Validates a logo/favicon file's magic bytes.
 * Returns true if the content matches an allowed image type.
 */
async function validateImageMagicBytes(file: File): Promise<boolean> {
  const bytes = await file.arrayBuffer();
  const buf = Buffer.from(bytes.slice(0, 12));

  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true;
  // GIF: GIF87a or GIF89a
  if (buf.slice(0, 3).toString('ascii') === 'GIF') return true;
  // WebP: RIFF....WEBP
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return true;
  // SVG: starts with '<' (XML/SVG) — allowed but treated as text, not binary magic
  if (buf[0] === 0x3C) return true; // '<'

  return false;
}

// GET /api/admin/settings
export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, 'settings.view');
  if (error) return error;

  try {
    const settings = await query<{ key_name: string; value: string; group_name: string }[]>(
      `SELECT key_name, value, group_name FROM settings WHERE deleted_at IS NULL ORDER BY group_name, key_name`
    );

    const grouped: Record<string, Record<string, string>> = {};
    for (const s of settings) {
      const group = KEY_GROUPS[s.key_name] ?? s.group_name;
      if (!grouped[group]) grouped[group] = {};
      // Mask sensitive keys — never expose secrets via the API
      grouped[group][s.key_name] = MASKED_KEYS.has(s.key_name) ? MASK_VALUE : s.value;
    }

    return NextResponse.json({ settings: grouped });
  } catch (err) {
    console.error('Settings GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/settings
export async function POST(req: NextRequest) {
  const { error, user: actor } = await requirePermission(req, 'settings.edit');
  if (error) return error;

  try {
    const contentType = req.headers.get('content-type') || '';

    let updates: Record<string, string> = {};

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();

      // First pass — collect all plain text fields (excludes the two file fields)
      formData.forEach((value, key) => {
        if (key !== 'site_logo_file' && key !== 'site_favicon_file') {
          updates[key] = value.toString();
        }
      });

      // Handle logo upload — runs AFTER flat fields so the file path always wins
      const logoFile = formData.get('site_logo_file') as File | null;
      if (logoFile && logoFile.size > 0) {
        if (logoFile.size > MAX_LOGO_SIZE) {
          return NextResponse.json({ error: 'Logo file must be under 2 MB' }, { status: 400 });
        }
        // Validate magic bytes — do NOT trust Content-Type header
        const validLogo = await validateImageMagicBytes(logoFile);
        if (!validLogo) {
          return NextResponse.json({ error: 'Invalid logo file format. Use JPEG, PNG, GIF, WebP, or SVG.' }, { status: 400 });
        }
        const ext = logoFile.name.split('.').pop()?.toLowerCase() || 'png';
        const fileName = `logo_${Date.now()}.${ext}`;
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'logos');
        await mkdir(uploadDir, { recursive: true });
        const bytes = await logoFile.arrayBuffer();
        await writeFile(path.join(uploadDir, fileName), Buffer.from(bytes));
        updates['site_logo'] = `/uploads/logos/${fileName}`;
      }

      // Handle favicon upload — same pattern
      const faviconFile = formData.get('site_favicon_file') as File | null;
      if (faviconFile && faviconFile.size > 0) {
        if (faviconFile.size > MAX_LOGO_SIZE) {
          return NextResponse.json({ error: 'Favicon file must be under 2 MB' }, { status: 400 });
        }
        const validFavicon = await validateImageMagicBytes(faviconFile);
        if (!validFavicon) {
          return NextResponse.json({ error: 'Invalid favicon file format. Use JPEG, PNG, GIF, WebP, or SVG.' }, { status: 400 });
        }
        const ext = faviconFile.name.split('.').pop()?.toLowerCase() || 'ico';
        const fileName = `favicon_${Date.now()}.${ext}`;
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'logos');
        await mkdir(uploadDir, { recursive: true });
        const bytes = await faviconFile.arrayBuffer();
        await writeFile(path.join(uploadDir, fileName), Buffer.from(bytes));
        updates['site_favicon'] = `/uploads/logos/${fileName}`;
      }
    } else {
      updates = await req.json();
    }

    // If the client sends the mask value back for a sensitive key, skip it —
    // this means the user didn't change it, so we must not overwrite with '••••••••'
    // Also skip if the value is empty (user wants to keep existing value)
    for (const key of Object.keys(updates)) {
      if (MASKED_KEYS.has(key) && (updates[key] === MASK_VALUE || updates[key].trim() === '')) {
        delete updates[key];
      }
    }

    for (let [key, value] of Object.entries(updates)) {
      // Normalize escaped newlines in the Firebase private key.
      if (key === 'fcm_private_key' && value.includes('\\n')) {
        value = value.replace(/\\n/g, '\n');
      }

      const group = KEY_GROUPS[key] ?? 'general';
      await query(
        `INSERT INTO settings (key_name, value, group_name)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()`,
        [key, value, group, value]
      );
    }

    await logActivity({
      userId: actor!.userId, userName: actor!.email,
      action: 'Updated', module: 'settings',
      description: `Updated ${Object.keys(updates).length} setting(s)`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Settings POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}