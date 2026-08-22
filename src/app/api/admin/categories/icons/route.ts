import { NextResponse } from 'next/server';
import { readdir } from 'fs/promises';
import path from 'path';

// GET /api/admin/categories/icons — list available category icons
export async function GET() {
  try {
    const iconsDir = path.join(process.cwd(), 'public', 'icons', 'categories');
    
    try {
      const files = await readdir(iconsDir);
      const icons = files
        .filter(file => /\.(png|jpg|jpeg|svg|webp)$/i.test(file))
        .map(file => ({
          name: file.replace(/\.(png|jpg|jpeg|svg|webp)$/i, '').replace(/-/g, ' '),
          slug: file.replace(/\.(png|jpg|jpeg|svg|webp)$/i, ''),
          path: `/icons/categories/${file}`,
        }));
      
      return NextResponse.json({ success: true, icons });
    } catch (err) {
      // Directory doesn't exist or is empty
      return NextResponse.json({ success: true, icons: [] });
    }
  } catch (err) {
    console.error('Icons GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
