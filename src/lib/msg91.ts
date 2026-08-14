import { query } from '@/lib/db';

interface Msg91Config {
  authKey: string;
  templateId: string;
  senderId: string;
  otpExpiryMinutes: number;
}

async function getMsg91Config(): Promise<Msg91Config | null> {
  try {
    const rows = await query<{ key_name: string; value: string }[]>(
      `SELECT key_name, value FROM settings
       WHERE key_name IN ('msg91_auth_key','msg91_template_id','msg91_sender_id','msg91_otp_expiry_minutes')
         AND deleted_at IS NULL`
    );
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key_name] = r.value;

    if (!map['msg91_auth_key'] || !map['msg91_template_id']) return null;

    return {
      authKey: map['msg91_auth_key'],
      templateId: map['msg91_template_id'],
      senderId: map['msg91_sender_id'] || 'WRKWLA',
      otpExpiryMinutes: parseInt(map['msg91_otp_expiry_minutes'] || '5', 10),
    };
  } catch {
    return null;
  }
}

/**
 * Sends an OTP via MSG91 Flow API.
 * Returns { sent: true } on success.
 * Returns { sent: false, devMode: true, otp } when MSG91 is not configured (dev fallback).
 */
export async function sendOtp(
  phone: string,
  otp: string
): Promise<{ sent: boolean; devMode?: boolean; otp?: string }> {
  const config = await getMsg91Config();

  if (!config) {
    // Dev mode — log OTP to console, treat as success
    console.log(`[MSG91 DEV MODE] OTP for +91${phone}: ${otp}`);
    return { sent: true, devMode: true, otp };
  }

  const payload = {
    template_id: config.templateId,
    sender: config.senderId,
    short_url: '0',
    mobiles: `91${phone}`,
    VAR1: otp,
  };

  const res = await fetch('https://control.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authkey: config.authKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[MSG91] Error:', text);
    return { sent: false };
  }

  return { sent: true };
}

/** Returns the configured OTP expiry in minutes (default 5). */
export async function getOtpExpiryMinutes(): Promise<number> {
  const config = await getMsg91Config();
  return config?.otpExpiryMinutes ?? 5;
}
