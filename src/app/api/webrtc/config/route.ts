import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * GET /api/webrtc/config
 * Returns WebRTC configuration (STUN/TURN servers) for Flutter apps
 * Reads from settings table to provide environment-specific config
 */
export async function GET(request: Request) {
  try {
    // Fetch WebRTC settings from database
    const settings = await query<Array<{ key_name: string; value: string }>>(
      `SELECT key_name, value FROM settings WHERE key_name IN (?, ?, ?, ?, ?, ?, ?)`,
      [
        'webrtc_enabled',
        'webrtc_environment',
        'turn_server',
        'stun_port',
        'turn_port',
        'turns_port',
        'turn_secret'
      ]
    );

    // Convert array to object
    const config: Record<string, string> = {};
    settings.forEach((row) => {
      config[row.key_name] = row.value;
    });

    // Check if WebRTC is enabled (supports both '1' and 'true' values)
    const webrtcEnabled = config.webrtc_enabled === '1' || config.webrtc_enabled === 'true';
    
    // If disabled, return minimal config indicating feature is off
    if (!webrtcEnabled) {
      return NextResponse.json({
        enabled: false,
        message: 'WebRTC calling is disabled. Use device native calling.',
        fallback_mode: 'native_dialer',
      });
    }

    // Determine environment (fallback to development)
    const environment = config.webrtc_environment || process.env.NODE_ENV || 'development';
    
    // Parse ports with defaults
    const stunPort = parseInt(config.stun_port || '3478');
    const turnPort = parseInt(config.turn_port || '3478');
    const turnsPort = parseInt(config.turns_port || '5349');
    
    // Get TURN server - strip port if included (e.g., "localhost:3478" -> "localhost")
    let turnServer = config.turn_server || 'localhost';
    if (turnServer.includes(':')) {
      turnServer = turnServer.split(':')[0];
    }
    const turnSecret = config.turn_secret || 'mySecretKey123';

    // Build ICE servers configuration
    interface IceServer {
      urls: string;
      username?: string;
      credential?: string;
    }
    
    const iceServers: IceServer[] = [
      // Public STUN servers (always available as fallback)
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];

    // Add custom STUN server if configured
    if (turnServer && turnServer !== 'localhost') {
      iceServers.push({
        urls: `stun:${turnServer}:${stunPort}`,
      });
    }

    // Add TURN servers if configured
    if (turnServer && turnSecret) {
      iceServers.push(
        {
          urls: `turn:${turnServer}:${turnPort}`,
          username: 'webrtc',
          credential: turnSecret,
        },
        {
          urls: `turn:${turnServer}:${turnPort}?transport=tcp`,
          username: 'webrtc',
          credential: turnSecret,
        }
      );

      // Add TURNS (secure) for production
      if (environment === 'production' && turnServer !== 'localhost') {
        iceServers.push({
          urls: `turns:${turnServer}:${turnsPort}`,
          username: 'webrtc',
          credential: turnSecret,
        });
      }
    }

    // Determine signaling URL from request host or environment variable
    const url = new URL(request.url);
    const signalingUrl = process.env.NEXT_PUBLIC_API_URL || `${url.protocol}//${url.host}`;
    
    // Return configuration
    return NextResponse.json({
      enabled: true,
      environment,
      signaling_url: signalingUrl,
      ice_servers: iceServers,
      turn_server: turnServer,
      stun_port: stunPort,
      turn_port: turnPort,
      turns_port: turnsPort,
    });
  } catch (error) {
    console.error('Error fetching WebRTC config:', error);
    
    // Return fallback configuration indicating WebRTC is disabled
    return NextResponse.json({
      enabled: false,
      message: 'WebRTC calling is disabled or configuration error occurred.',
      fallback_mode: 'native_dialer',
    });
  }
}
