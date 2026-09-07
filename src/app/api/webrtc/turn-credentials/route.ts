import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import crypto from 'crypto';

/**
 * GET /api/webrtc/turn-credentials
 * Generates temporary TURN credentials using HMAC-SHA1
 * Based on RFC 5766 (TURN) time-limited credentials mechanism
 */
export async function GET() {
  try {
    // Fetch TURN secret from settings
    const settings = await query<Array<{ key_name: string; value: string }>>(
      `SELECT key_name, value FROM settings WHERE key_name IN (?, ?)`,
      ['turn_server', 'turn_secret']
    );

    const config: Record<string, string> = {};
    settings.forEach((row) => {
      config[row.key_name] = row.value;
    });

    const turnServer = config.turn_server || 'localhost';
    const turnSecret = config.turn_secret || 'mySecretKey123';

    // Generate time-limited credentials
    // Username format: timestamp:randomstring
    // Credential: base64(hmac-sha1(secret, username))
    const timestamp = Math.floor(Date.now() / 1000) + 3600; // Valid for 1 hour
    const username = `${timestamp}:webrtc`;
    
    // Generate HMAC-SHA1 credential
    const hmac = crypto.createHmac('sha1', turnSecret);
    hmac.update(username);
    const credential = hmac.digest('base64');

    return NextResponse.json({
      username,
      credential,
      ttl: 3600, // 1 hour in seconds
      urls: [
        `turn:${turnServer}:3478`,
        `turn:${turnServer}:3478?transport=tcp`,
        `turns:${turnServer}:5349`,
      ],
    });
  } catch (error) {
    console.error('Error generating TURN credentials:', error);
    return NextResponse.json(
      { error: 'Failed to generate TURN credentials' },
      { status: 500 }
    );
  }
}
