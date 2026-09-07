import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import crypto from 'crypto';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'workwala',
};

/**
 * GET /api/public/webrtc/turn-credentials
 * Generates temporary TURN credentials for WebRTC
 * Public endpoint - no authentication required (credentials are time-limited)
 */
export async function GET(request: NextRequest) {
  let connection;
  
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    
    // Get current environment
    const env = process.env.NODE_ENV || 'development';
    
    // Fetch TURN configuration from database
    const [rows] = await connection.execute(
      'SELECT * FROM turn_config WHERE environment = ? AND is_active = 1 LIMIT 1',
      [env]
    );
    
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('TURN configuration not found for environment: ' + env);
    }
    
    const turnConfig: any = rows[0];
    
    // Generate time-limited credentials
    const username = Math.floor(Date.now() / 1000) + 3600; // Valid for 1 hour
    const hmac = crypto.createHmac('sha1', turnConfig.turn_secret);
    hmac.update(username.toString());
    const credential = hmac.digest('base64');
    
    // Build ICE servers configuration
    const iceServers = [
      {
        urls: `stun:${turnConfig.turn_server}:${turnConfig.stun_port}`
      },
      {
        urls: `turn:${turnConfig.turn_server}:${turnConfig.turn_port}`,
        username: username.toString(),
        credential: credential
      },
      {
        urls: `turn:${turnConfig.turn_server}:${turnConfig.turn_port}?transport=tcp`,
        username: username.toString(),
        credential: credential
      }
    ];
    
    // Add TURNS (secure) only in production
    if (env === 'production') {
      iceServers.push({
        urls: `turns:${turnConfig.turn_server}:${turnConfig.turns_port}?transport=tcp`,
        username: username.toString(),
        credential: credential
      });
    }
    
    return NextResponse.json({
      success: true,
      data: {
        iceServers,
        environment: env
      }
    });
    
  } catch (error: any) {
    console.error('Error generating TURN credentials:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to generate TURN credentials',
        error: error.message 
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
