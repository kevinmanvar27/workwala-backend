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
 * PUT /api/public/webrtc/calls/[callId]/status
 * Update call status (connected, ended, missed, rejected, failed)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  let connection;
  
  try {
    const { callId } = await params;
    const body = await request.json();
    const { status, duration, connectionType, endReason } = body;
    
    if (!status) {
      return NextResponse.json(
        { success: false, message: 'Status is required' },
        { status: 400 }
      );
    }
    
    const validStatuses = ['calling', 'ringing', 'connected', 'ended', 'missed', 'rejected', 'failed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, message: 'Invalid status' },
        { status: 400 }
      );
    }
    
    connection = await mysql.createConnection(DB_CONFIG);
    
    // Build update query dynamically
    let updateFields = ['status = ?'];
    let updateValues = [status];
    
    if (status === 'connected' && !duration) {
      updateFields.push('started_at = NOW()');
    }
    
    if (status === 'ended' && duration !== undefined) {
      updateFields.push('duration = ?');
      updateFields.push('ended_at = NOW()');
      updateValues.push(duration);
    }
    
    if (connectionType) {
      updateFields.push('connection_type = ?');
      updateValues.push(connectionType);
    }
    
    if (endReason) {
      updateFields.push('end_reason = ?');
      updateValues.push(endReason);
    }
    
    updateValues.push(callId);
    
    const [result] = await connection.execute(
      `UPDATE calls SET ${updateFields.join(', ')} WHERE call_id = ?`,
      updateValues
    );
    
    if ((result as any).affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: 'Call not found' },
        { status: 404 }
      );
    }
    
    // Get updated call
    const [calls] = await connection.execute(
      'SELECT * FROM calls WHERE call_id = ?',
      [callId]
    );
    
    return NextResponse.json({
      success: true,
      data: Array.isArray(calls) && calls.length > 0 ? calls[0] : null
    });
    
  } catch (error: any) {
    console.error('Error updating call status:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to update call status',
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

/**
 * GET /api/public/webrtc/calls/[callId]/status
 * Get call status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  let connection;
  
  try {
    const { callId } = await params;
    
    connection = await mysql.createConnection(DB_CONFIG);
    
    const [calls] = await connection.execute(
      'SELECT * FROM calls WHERE call_id = ?',
      [callId]
    );
    
    if (!Array.isArray(calls) || calls.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Call not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: calls[0]
    });
    
  } catch (error: any) {
    console.error('Error fetching call status:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch call status',
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
