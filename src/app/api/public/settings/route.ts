import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/public/settings
// Returns only safe public settings (no secrets). Used by root layout for meta/favicon/GA injection.
export async function GET() {
  try {
    const rows = await query<{ key_name: string; value: string }[]>(
      `SELECT key_name, value FROM settings
       WHERE deleted_at IS NULL
         AND key_name IN (
           'site_name', 'site_tagline', 'site_logo', 'site_favicon', 'site_url',
           'meta_title', 'meta_description', 'meta_keywords', 'meta_author',
           'meta_og_image', 'og_title', 'og_description', 'copyright_text',
           'ga_script',
           'google_login_enabled', 'apple_login_enabled', 'manual_login_enabled',
           'color_primary', 'color_accent', 'color_sidebar',
           'playstore_partner_url', 'playstore_customer_url',
           'appstore_partner_url', 'appstore_customer_url'
         )
       ORDER BY key_name`
    );

    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key_name] = row.value ?? '';
    }

    return NextResponse.json({ settings });
  } catch (err) {
    console.error('Public settings GET error:', err);
    return NextResponse.json({ settings: {} });
  }
}
