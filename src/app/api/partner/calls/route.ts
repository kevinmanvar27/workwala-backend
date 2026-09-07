import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'workwala',
};

/**
 * POST /api/partner/calls
 * Create a new call record (partner calling customer)
 */
export async function POST(request: NextRequest) {
  let connection;
  
  try {
    const body = await request.json();
    const { receiverPhone, callType = 'video', bookingId } = body;
    
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    connection = await mysql.createConnection(DB_CONFIG);
    
    const { partnerId, partnerPhone } = body;
    
    if (!partnerId || !partnerPhone || !receiverPhone) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Find receiver (customer)
    const [customers] = await connection.execute(
      'SELECT id, phone, name FROM customers WHERE phone = ? AND deleted_at IS NULL',
      [receiverPhone]
    );
    
    if (!Array.isArray(customers) || customers.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Customer not found' },
        { status: 404 }
      );
    }
    
    const customer: any = customers[0];
    const callId = uuidv4();
    
    await connection.execute(
      `INSERT INTO calls (
        call_id, caller_type, caller_id, caller_phone,
        receiver_type, receiver_id, receiver_phone,
        status, call_type, booking_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        callId,
        'partner',
        partnerId,
        partnerPhone,
        'customer',
        customer.id,
        receiverPhone,
        'calling',
        callType,
        bookingId || null
      ]
    );
    
    return NextResponse.json({
      success: true,
      data: {
        callId,
        receiverType: 'customer',
        receiverId: customer.id,
        status: 'calling'
      }
    });
    
  } catch (error: any) {
    console.error('Error creating call:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to create call',
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
 * GET /api/partner/calls
 * Get call history for partner
 */
export async function GET(request: NextRequest) {
  let connection;
  
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get('partnerId');
    
    if (!partnerId) {
      return NextResponse.json(
        { success: false, message: 'Partner ID required' },
        { status: 400 }
      );
    }
    
    connection = await mysql.createConnection(DB_CONFIG);
    
    const [calls] = await connection.execute(
      `SELECT 
        c.*,
        cu.name as receiver_name
      FROM calls c
      LEFT JOIN customers cu ON c.receiver_type = 'customer' AND c.receiver_id = cu.id
      WHERE c.caller_type = 'partner' AND c.caller_id = ?
      ORDER BY c.created_at DESC
      LIMIT 50`,
      [partnerId]
    );
    
    return NextResponse.json({
      success: true,
      data: calls
    });
    
  } catch (error: any) {
    console.error('Error fetching calls:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch calls',
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
