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
  fcm_project_id:             'notifications',
  fcm_client_email:           'notifications',
  fcm_private_key:            'notifications',
  // App Links
  playstore_url:              'app_links',
  appstore_url:               'app_links',
  // SMS / OTP (MSG91)
  msg91_auth_key:             'sms',
  msg91_template_id:          'sms',
  msg91_sender_id:            'sms',
  msg91_otp_expiry_minutes:   'sms',
};

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
      // Always use the canonical group from KEY_GROUPS; fall back to the DB value
      // so unknown/custom keys still appear under whatever group they were saved with.
      const group = KEY_GROUPS[s.key_name] ?? s.group_name;
      if (!grouped[group]) grouped[group] = {};
      grouped[group][s.key_name] = s.value;
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
      // over any empty site_logo string that came from the settings state
      const logoFile = formData.get('site_logo_file') as File | null;
      if (logoFile && logoFile.size > 0) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        if (!allowedTypes.includes(logoFile.type)) {
          return NextResponse.json({ error: 'Invalid logo file type' }, { status: 400 });
        }
        const ext = logoFile.name.split('.').pop();
        const fileName = `logo_${Date.now()}.${ext}`;
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'logos');
        await mkdir(uploadDir, { recursive: true });
        const bytes = await logoFile.arrayBuffer();
        await writeFile(path.join(uploadDir, fileName), Buffer.from(bytes));
        updates['site_logo'] = `/uploads/logos/${fileName}`; // overwrite empty string
      }

      // Handle favicon upload — same pattern
      const faviconFile = formData.get('site_favicon_file') as File | null;
      if (faviconFile && faviconFile.size > 0) {
        const allowedTypes = ['image/x-icon', 'image/png', 'image/svg+xml', 'image/webp', 'image/vnd.microsoft.icon'];
        if (!allowedTypes.includes(faviconFile.type)) {
          return NextResponse.json({ error: 'Invalid favicon file type' }, { status: 400 });
        }
        const ext = faviconFile.name.split('.').pop();
        const fileName = `favicon_${Date.now()}.${ext}`;
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'logos');
        await mkdir(uploadDir, { recursive: true });
        const bytes = await faviconFile.arrayBuffer();
        await writeFile(path.join(uploadDir, fileName), Buffer.from(bytes));
        updates['site_favicon'] = `/uploads/logos/${fileName}`; // overwrite empty string
      }
    } else {
      updates = await req.json();
    }

    for (let [key, value] of Object.entries(updates)) {
      // Normalize escaped newlines in the Firebase private key.
      // The Firebase service account JSON stores the key with literal \n sequences.
      // When pasted into the textarea they arrive as \\n — convert to real newlines
      // so firebase-admin can parse the PEM key correctly.
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