import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'workwala',
};

/**
 * GET /api/public/webrtc/config
 * Returns WebRTC configuration including signaling URL and environment
 * Public endpoint - no authentication required
 */
export async function GET(request: NextRequest) {
  try {
    const env = process.env.NODE_ENV || 'development';
    const config = require('../../../../../config');

    return NextResponse.json({
      success: true,
      data: {
        environment: config.environment,
        signalingUrl: config.signalingUrl,
        wsUrl: config.wsUrl,
      }
    });
  } catch (error: any) {
    console.error('Error fetching WebRTC config:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch configuration',
        error: error.message 
      },
      { status: 500 }
    );
  }
}
