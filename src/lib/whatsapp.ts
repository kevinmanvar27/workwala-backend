import { query } from '@/lib/db';

interface WhatsAppConfig {
  enabled: boolean;
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  webhookVerifyToken: string;
}

/**
 * Fetches WhatsApp configuration from the database.
 * Returns null if WhatsApp is disabled or required fields are missing.
 */
async function getWhatsAppConfig(): Promise<WhatsAppConfig | null> {
  try {
    const rows = await query<{ key_name: string; value: string }[]>(
      `SELECT key_name, value FROM settings
       WHERE key_name IN (
         'whatsapp_enabled',
         'whatsapp_phone_number_id',
         'whatsapp_business_account_id',
         'whatsapp_access_token',
         'whatsapp_webhook_verify_token'
       ) AND deleted_at IS NULL`
    );
    
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key_name] = r.value;

    // Check if WhatsApp is enabled and required fields are present
    if (map['whatsapp_enabled'] !== '1' || !map['whatsapp_access_token'] || !map['whatsapp_phone_number_id']) {
      return null;
    }

    return {
      enabled: map['whatsapp_enabled'] === '1',
      phoneNumberId: map['whatsapp_phone_number_id'],
      businessAccountId: map['whatsapp_business_account_id'] || '',
      accessToken: map['whatsapp_access_token'],
      webhookVerifyToken: map['whatsapp_webhook_verify_token'] || '',
    };
  } catch {
    return null;
  }
}

/**
 * Sends an OTP via WhatsApp using Meta Business API.
 * Returns { sent: true } on success.
 * Returns { sent: false, devMode: true, otp } when WhatsApp is not configured (dev fallback).
 */
export async function sendWhatsAppOtp(
  phone: string,
  otp: string
): Promise<{ sent: boolean; devMode?: boolean; otp?: string }> {
  const config = await getWhatsAppConfig();

  if (!config) {
    // Dev mode — log OTP to console, treat as success
    console.log(`[WHATSAPP DEV MODE] OTP for +91${phone}: ${otp}`);
    return { sent: true, devMode: true, otp };
  }

  // WhatsApp template message payload
  const payload = {
    messaging_product: 'whatsapp',
    to: `91${phone}`,
    type: 'template',
    template: {
      name: 'otp_verification', // Your template name in Meta Business
      language: {
        code: 'en'
      },
      components: [
        {
          type: 'body',
          parameters: [
            {
              type: 'text',
              text: otp
            }
          ]
        }
      ]
    }
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.accessToken}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error('[WHATSAPP] Error:', text);
      return { sent: false };
    }

    const data = await res.json();
    console.log('[WHATSAPP] OTP sent successfully:', data);
    return { sent: true };
  } catch (error) {
    console.error('[WHATSAPP] Exception:', error);
    return { sent: false };
  }
}

/**
 * Check if WhatsApp integration is enabled and properly configured.
 * Returns true if WhatsApp can be used to send OTPs.
 */
export async function isWhatsAppEnabled(): Promise<boolean> {
  const config = await getWhatsAppConfig();
  return config !== null && config.enabled;
}
