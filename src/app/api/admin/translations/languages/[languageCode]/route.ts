/**
 * Admin API: Manage Individual Language
 * 
 * PATCH  /api/admin/translations/languages/[languageCode] - Update language (activate/deactivate, rename, reorder)
 * DELETE /api/admin/translations/languages/[languageCode] - Delete language and all its translations
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';

interface Language {
  id: number;
  code: string;
  name: string;
  native_name: string;
  is_active: boolean;
  sort_order: number;
}

// PATCH - Update language (activate/deactivate, rename, reorder)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ languageCode: string }> }
) {
  const { error } = await requirePermission(request, 'settings.view');
  if (error) return error;

  try {

    const { languageCode } = await params;
    const body = await request.json();

    // Check if language exists
    const existing = await query<Language[]>(
      `SELECT * FROM languages WHERE code = ?`,
      [languageCode]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Language not found' },
        { status: 404 }
      );
    }

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: any[] = [];

    if (body.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(body.is_active);
    }

    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name);
    }

    if (body.native_name !== undefined) {
      updates.push('native_name = ?');
      values.push(body.native_name);
    }

    if (body.sort_order !== undefined) {
      updates.push('sort_order = ?');
      values.push(body.sort_order);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Add languageCode to values for WHERE clause
    values.push(languageCode);

    // Execute update
    await query(
      `UPDATE languages SET ${updates.join(', ')}, updated_at = NOW() WHERE code = ?`,
      values
    );

    // Increment version if translations exist
    if (body.is_active !== undefined) {
      await query(
        `UPDATE translation_versions 
         SET version = CONCAT(SUBSTRING_INDEX(version, '.', 2), '.', 
              CAST(SUBSTRING_INDEX(version, '.', -1) AS UNSIGNED) + 1),
             updated_at = NOW(),
             change_summary = ?
         WHERE language_code = ?`,
        [
          body.is_active ? 'Language activated' : 'Language deactivated',
          languageCode
        ]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Language updated successfully',
    });

  } catch (error) {
    console.error('Error updating language:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update language',
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete language and all its translations
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ languageCode: string }> }
) {
  const { error } = await requirePermission(request, 'settings.view');
  if (error) return error;

  try {

    const { languageCode } = await params;

    // Check if language exists
    const existing = await query<Language[]>(
      `SELECT * FROM languages WHERE code = ?`,
      [languageCode]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Language not found' },
        { status: 404 }
      );
    }

    // Prevent deletion of default languages
    if (['en', 'hi', 'gu', 'mr'].includes(languageCode)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete default languages',
        },
        { status: 400 }
      );
    }

    // Delete language (CASCADE will delete translations and versions)
    await query(`DELETE FROM languages WHERE code = ?`, [languageCode]);

    return NextResponse.json({
      success: true,
      message: 'Language and all its translations deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting language:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete language',
      },
      { status: 500 }
    );
  }
}
