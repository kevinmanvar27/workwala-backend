import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireMobileAuth } from '@/lib/mobileAuth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// POST /api/partner/profile/update
// Updates partner profile data (name, gender, language, categories, team_option, vehicle_type)
// Also handles document uploads (id_front, id_back, selfie, bank_doc)
export async function POST(req: NextRequest) {
  try {
    const { error: authError, user: payload } = await requireMobileAuth(req, 'partner');
    if (authError) return authError;

    const formData = await req.formData();
    
    // Extract text fields
    const name = formData.get('name')?.toString() || null;
    const gender = formData.get('gender')?.toString() || null;
    const language = formData.get('language')?.toString() || null;
    const categories = formData.get('categories')?.toString() || '[]';
    const teamOption = formData.get('team_option')?.toString() || null;
    const vehicleType = formData.get('vehicle_type')?.toString() || null;

    console.log('[Profile Update] Received data:', {
      partnerId: payload.userId,
      name,
      gender,
      language,
      categories,
      teamOption,
      vehicleType,
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💾 [BACKEND] Updating partner profile');
    console.log(`   Partner ID: ${payload.userId}`);
    console.log(`   Categories received: ${categories}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Update partner basic info
    await query(
      `UPDATE partners 
       SET name = ?, 
           gender = ?, 
           language = ?, 
           categories = ?,
           team_option = ?,
           vehicle_type = ?,
           updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [name, gender, language, categories, teamOption, vehicleType, payload.userId]
    );

    console.log('✅ [BACKEND] Partner profile updated in database');

    // Handle document uploads
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'partners', String(payload.userId));
    
    // Create directory if it doesn't exist
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const documentFields = ['id_front', 'id_back', 'selfie'];
    const uploadedDocs: Record<string, string> = {};
    let bankDocPath: string | null = null;

    // Handle regular documents (id_front, id_back, selfie)
    for (const field of documentFields) {
      const file = formData.get(field) as File | null;
      if (file && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = `${field}_${Date.now()}.${file.name.split('.').pop()}`;
        const filepath = join(uploadDir, filename);
        
        await writeFile(filepath, buffer);
        
        // Store relative path for database
        uploadedDocs[field] = `/uploads/partners/${payload.userId}/${filename}`;
        
        console.log(`[Profile Update] Uploaded ${field}: ${uploadedDocs[field]}`);
      }
    }

    // Handle bank document separately (goes to partner_bank_documents table)
    const bankDocFile = formData.get('bank_doc') as File | null;
    if (bankDocFile && bankDocFile.size > 0) {
      const buffer = Buffer.from(await bankDocFile.arrayBuffer());
      const filename = `bank_doc_${Date.now()}.${bankDocFile.name.split('.').pop()}`;
      const filepath = join(uploadDir, filename);
      
      await writeFile(filepath, buffer);
      
      bankDocPath = `/uploads/partners/${payload.userId}/${filename}`;
      console.log(`[Profile Update] Uploaded bank_doc: ${bankDocPath}`);
    }

    // Update partner_documents table if any documents were uploaded
    if (Object.keys(uploadedDocs).length > 0) {
      // Check if partner_documents record exists
      const existingDocs = await query<{ partner_id: number }[]>(
        'SELECT partner_id FROM partner_documents WHERE partner_id = ?',
        [payload.userId]
      );

      if (existingDocs.length > 0) {
        // Update existing record
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        
        if (uploadedDocs.id_front) {
          updateFields.push('id_front = ?');
          updateValues.push(uploadedDocs.id_front);
        }
        if (uploadedDocs.id_back) {
          updateFields.push('id_back = ?');
          updateValues.push(uploadedDocs.id_back);
        }
        if (uploadedDocs.selfie) {
          updateFields.push('selfie = ?');
          updateValues.push(uploadedDocs.selfie);
        }
        
        updateFields.push('updated_at = NOW()');
        updateValues.push(payload.userId);

        if (updateFields.length > 1) { // More than just updated_at
          await query(
            `UPDATE partner_documents SET ${updateFields.join(', ')} WHERE partner_id = ?`,
            updateValues
          );
        }
      } else {
        // Insert new record
        await query(
          `INSERT INTO partner_documents (partner_id, id_front, id_back, selfie, created_at, updated_at)
           VALUES (?, ?, ?, ?, NOW(), NOW())`,
          [
            payload.userId,
            uploadedDocs.id_front || null,
            uploadedDocs.id_back || null,
            uploadedDocs.selfie || null,
          ]
        );
      }
    }

    // Update partner_bank_documents table if bank document was uploaded
    if (bankDocPath) {
      const existingBankDocs = await query<{ partner_id: number }[]>(
        'SELECT partner_id FROM partner_bank_documents WHERE partner_id = ?',
        [payload.userId]
      );

      if (existingBankDocs.length > 0) {
        // Update existing record
        await query(
          `UPDATE partner_bank_documents SET document_path = ?, updated_at = NOW() WHERE partner_id = ?`,
          [bankDocPath, payload.userId]
        );
      } else {
        // Insert new record
        await query(
          `INSERT INTO partner_bank_documents (partner_id, document_path, created_at, updated_at)
           VALUES (?, ?, NOW(), NOW())`,
          [payload.userId, bankDocPath]
        );
      }
    }

    // Fetch updated profile to return
    const partners = await query<{
      id: number;
      name: string | null;
      phone: string;
      gender: string | null;
      language: string | null;
      categories: string | null;
      team_option: string | null;
      vehicle_type: string | null;
      status: string;
    }[]>(
      `SELECT id, name, phone, gender, language, categories, team_option, vehicle_type, status
       FROM partners
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [payload.userId]
    );

    if (partners.length === 0) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const partner = partners[0];

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 [BACKEND] Fetched updated profile from database');
    console.log(`   Partner ID: ${partner.id}`);
    console.log(`   Categories from DB: ${partner.categories}`);
    console.log(`   Categories type: ${typeof partner.categories}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Get document URLs
    const docs = await query<{
      id_front: string | null;
      id_back: string | null;
      selfie: string | null;
    }[]>(
      'SELECT id_front, id_back, selfie FROM partner_documents WHERE partner_id = ?',
      [payload.userId]
    );

    const doc = docs[0] || { id_front: null, id_back: null, selfie: null };

    // Get bank document URL from separate table
    const bankDocs = await query<{
      document_path: string | null;
    }[]>(
      'SELECT document_path FROM partner_bank_documents WHERE partner_id = ?',
      [payload.userId]
    );
    const bankDocUrl = bankDocs[0]?.document_path || null;

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      partner: {
        id: partner.id,
        name: partner.name,
        phone: partner.phone,
        gender: partner.gender,
        language: partner.language,
        categories: (() => { 
          try { 
            if (!partner.categories) return [];
            
            // Handle different category formats
            if (typeof partner.categories === 'string') {
              const trimmed = partner.categories.trim();
              if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                // JSON format: ["Driver","Cooking"] or {"0":"Driver","1":"Cooking"}
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                  console.log(`✅ [BACKEND] Parsed categories as JSON array: ${JSON.stringify(parsed)}`);
                  return parsed;
                } else if (typeof parsed === 'object') {
                  const values = Object.values(parsed);
                  console.log(`✅ [BACKEND] Parsed categories as JSON object: ${JSON.stringify(values)}`);
                  return values;
                }
              } else {
                // Comma-separated string format
                const parsed = trimmed.split(',').map((c: string) => c.trim()).filter((c: string) => c.length > 0);
                console.log(`✅ [BACKEND] Parsed categories as CSV: ${JSON.stringify(parsed)}`);
                return parsed;
              }
            } else if (Array.isArray(partner.categories)) {
              // Already an array
              console.log(`✅ [BACKEND] Categories already an array: ${JSON.stringify(partner.categories)}`);
              return partner.categories;
            } else if (typeof partner.categories === 'object') {
              // Object format: {0: "Driver", 1: "Cooking"}
              const values = Object.values(partner.categories);
              console.log(`✅ [BACKEND] Parsed categories from object: ${JSON.stringify(values)}`);
              return values;
            }
            
            return [];
          } catch (err) { 
            console.log(`❌ [BACKEND] Failed to parse categories: ${err}`);
            return []; 
          } 
        })(),
        team_option: partner.team_option,
        vehicle_type: partner.vehicle_type,
        status: partner.status,
        id_front_url: doc.id_front,
        id_back_url: doc.id_back,
        selfie_url: doc.selfie,
        bank_doc_url: bankDocUrl,
      },
    });
  } catch (err) {
    console.error('[Profile Update] Error:', err);
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error',
      message: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
}
