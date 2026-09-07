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
 * POST /api/customer/calls
 * Create a new call record
 * Requires authentication
 */
export async function POST(request: NextRequest) {
  let connection;
  
  try {
    const body = await request.json();
    const { receiverPhone, callType = 'video', bookingId } = body;
    
    // Get customer info from auth token (you'll need to implement this based on your auth)
    // For now, we'll extract from headers or body
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    connection = await mysql.createConnection(DB_CONFIG);
    
    // Verify token and get customer info (simplified - implement proper JWT verification)
    // This is a placeholder - you should use your existing auth middleware
    const token = authHeader.replace('Bearer ', '');
    
    // For now, get customer from body (in production, extract from verified JWT)
    const { customerId, customerPhone } = body;
    
    if (!customerId || !customerPhone || !receiverPhone) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Find receiver (could be partner or another customer)
    const [partners] = await connection.execute(
      'SELECT id, phone, name FROM partners WHERE phone = ? AND deleted_at IS NULL',
      [receiverPhone]
    );
    
    let receiverType = 'partner';
    let receiverId = null;
    
    if (Array.isArray(partners) && partners.length > 0) {
      receiverId = (partners[0] as any).id;
    } else {
      // Check if it's another customer
      const [customers] = await connection.execute(
        'SELECT id, phone, name FROM customers WHERE phone = ? AND deleted_at IS NULL',
        [receiverPhone]
      );
      
      if (Array.isArray(customers) && customers.length > 0) {
        receiverType = 'customer';
        receiverId = (customers[0] as any).id;
      } else {
        return NextResponse.json(
          { success: false, message: 'Receiver not found' },
          { status: 404 }
        );
      }
    }
    
    // Generate unique call ID
    const callId = uuidv4();
    
    // Create call record
    await connection.execute(
      `INSERT INTO calls (
        call_id, caller_type, caller_id, caller_phone,
        receiver_type, receiver_id, receiver_phone,
        status, call_type, booking_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        callId,
        'customer',
        customerId,
        customerPhone,
        receiverType,
        receiverId,
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
        receiverType,
        receiverId,
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
 * GET /api/customer/calls
 * Get call history for customer
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
    
    // Extract customer ID from token (implement proper JWT verification)
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    
    if (!customerId) {
      return NextResponse.json(
        { success: false, message: 'Customer ID required' },
        { status: 400 }
      );
    }
    
    connection = await mysql.createConnection(DB_CONFIG);
    
    // Get call history
    const [calls] = await connection.execute(
      `SELECT 
        c.*,
        CASE 
          WHEN c.receiver_type = 'partner' THEN p.name
          WHEN c.receiver_type = 'customer' THEN cu.name
        END as receiver_name
      FROM calls c
      LEFT JOIN partners p ON c.receiver_type = 'partner' AND c.receiver_id = p.id
      LEFT JOIN customers cu ON c.receiver_type = 'customer' AND c.receiver_id = cu.id
      WHERE c.caller_type = 'customer' AND c.caller_id = ?
      ORDER BY c.created_at DESC
      LIMIT 50`,
      [customerId]
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
