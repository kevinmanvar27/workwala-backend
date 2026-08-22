import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// GET /api/customer/profile/me
export async function GET(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'customer');
    if (authError) return authError;

    const customers = await query<{
      id: number;
      name: string | null;
      phone: string;
      email: string | null;
      language: string | null;
      avatar_url: string | null;
      created_at: Date;
    }[]>(
      `SELECT id, name, phone, email, language, avatar_url, created_at
       FROM customers
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [payload.userId]
    );

    if (customers.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const customer = customers[0];

    return NextResponse.json({
      success: true,
      id: customer.id,
      name: customer.name ?? '',
      phone: customer.phone,
      email: customer.email ?? '',
      language: customer.language ?? '',
      avatar_url: customer.avatar_url ?? null,
      created_at: customer.created_at,
    });
  } catch (err) {
    console.error('customer profile/me error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/customer/profile/me - Update profile (name, email)
export async function PUT(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'customer');
    if (authError) return authError;

    const body = await req.json();
    const { name, email } = body;

    console.log('[PUT /api/customer/profile/me] Request from user:', payload.userId);
    console.log('[PUT /api/customer/profile/me] Body:', { name, email });

    // Validate name (required)
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      console.log('[PUT /api/customer/profile/me] Validation failed: Name is required');
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    // Validate email if provided (optional)
    if (email && typeof email === 'string' && email.trim().length > 0) {
      const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
      if (!emailRegex.test(email.trim())) {
        console.log('[PUT /api/customer/profile/me] Validation failed: Invalid email format');
        return NextResponse.json({ success: false, error: 'Invalid email format' }, { status: 400 });
      }
    }

    // Update customer profile
    const result = await query(
      `UPDATE customers SET name = ?, email = ? WHERE id = ? AND deleted_at IS NULL`,
      [name.trim(), email?.trim() || null, payload.userId]
    );

    console.log('[PUT /api/customer/profile/me] Update result:', result);
    console.log('[PUT /api/customer/profile/me] Profile updated successfully');

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
    });
  } catch (err) {
    console.error('[PUT /api/customer/profile/me] Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/customer/profile/me - Update profile with avatar upload
export async function POST(req: NextRequest) {
  try {
    console.log('[POST /api/customer/profile/me] Starting profile update with avatar');
    
    const { error: authError, user: payload } = await requireMobileAuth(req, 'customer');
    if (authError) {
      console.log('[POST /api/customer/profile/me] Auth error:', authError);
      return authError;
    }

    console.log('[POST /api/customer/profile/me] User authenticated:', payload.userId);

    const formData = await req.formData();
    const name = formData.get('name') as string;
    const email = formData.get('email') as string | null;
    const avatar = formData.get('avatar') as File | null;

    console.log('[POST /api/customer/profile/me] Form data:', {
      name,
      email,
      hasAvatar: !!avatar,
      avatarSize: avatar?.size,
      avatarType: avatar?.type
    });

    // Validate name (required)
    if (!name || name.trim().length === 0) {
      console.log('[POST /api/customer/profile/me] Validation failed: Name is required');
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Validate email if provided (optional)
    if (email && email.trim().length > 0) {
      const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
      if (!emailRegex.test(email.trim())) {
        console.log('[POST /api/customer/profile/me] Validation failed: Invalid email format');
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
      }
    }

    let avatarUrl: string | null = null;

    // Handle avatar upload if provided
    if (avatar && avatar.size > 0) {
      console.log('[POST /api/customer/profile/me] Processing avatar upload...');
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(avatar.type)) {
        console.log('[POST /api/customer/profile/me] Invalid file type:', avatar.type);
        return NextResponse.json(
          { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed' },
          { status: 400 }
        );
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (avatar.size > maxSize) {
        console.log('[POST /api/customer/profile/me] File too large:', avatar.size);
        return NextResponse.json(
          { error: 'File size too large. Maximum size is 5MB' },
          { status: 400 }
        );
      }

      try {
        // Create uploads directory if it doesn't exist
        const uploadsDir = join(process.cwd(), 'public', 'uploads', 'customers');
        console.log('[POST /api/customer/profile/me] Uploads directory:', uploadsDir);
        
        if (!existsSync(uploadsDir)) {
          console.log('[POST /api/customer/profile/me] Creating uploads directory...');
          await mkdir(uploadsDir, { recursive: true });
          console.log('[POST /api/customer/profile/me] Directory created successfully');
        }

        // Generate unique filename
        const timestamp = Date.now();
        const extension = avatar.name.split('.').pop();
        const filename = `customer_${payload.userId}_${timestamp}.${extension}`;
        const filepath = join(uploadsDir, filename);

        console.log('[POST /api/customer/profile/me] Saving file to:', filepath);

        // Save file
        const bytes = await avatar.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filepath, buffer);

        avatarUrl = `/uploads/customers/${filename}`;
        console.log('[POST /api/customer/profile/me] File saved successfully:', avatarUrl);
      } catch (fileError) {
        console.error('[POST /api/customer/profile/me] File upload error:', fileError);
        return NextResponse.json(
          { error: `File upload failed: ${fileError instanceof Error ? fileError.message : 'Unknown error'}` },
          { status: 500 }
        );
      }
    }

    // Update customer profile
    console.log('[POST /api/customer/profile/me] Updating database...');
    try {
      if (avatarUrl) {
        await query(
          `UPDATE customers SET name = ?, email = ?, avatar_url = ? WHERE id = ? AND deleted_at IS NULL`,
          [name.trim(), email?.trim() || null, avatarUrl, payload.userId]
        );
      } else {
        await query(
          `UPDATE customers SET name = ?, email = ? WHERE id = ? AND deleted_at IS NULL`,
          [name.trim(), email?.trim() || null, payload.userId]
        );
      }
      console.log('[POST /api/customer/profile/me] Database updated successfully');
    } catch (dbError) {
      console.error('[POST /api/customer/profile/me] Database error:', dbError);
      return NextResponse.json(
        { error: `Database update failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    console.log('[POST /api/customer/profile/me] Profile update completed successfully');
    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      avatar_url: avatarUrl,
    });
  } catch (err) {
    console.error('[POST /api/customer/profile/me] Unexpected error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ 
      error: 'Internal server error',
      details: errorMessage 
    }, { status: 500 });
  }
}
