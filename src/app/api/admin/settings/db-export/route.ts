import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { logActivity, getClientIp } from '@/lib/activityLogger';

// All exportable tables in the application
const EXPORTABLE_TABLES = [
  'roles',
  'permissions',
  'role_permissions',
  'users',
  'pages',
  'settings',
  'password_resets',
  'delete_account_requests',
  'activity_logs',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeSQL(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  // Escape string for SQL
  return `'${String(val)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x00/g, '\\0')
    .replace(/\x1a/g, '\\Z')}'`;
}

function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function getTableColumns(tableName: string): Promise<string[]> {
  const rows = await query<{ Field: string }[]>(`SHOW COLUMNS FROM \`${tableName}\``);
  return rows.map((r) => r.Field);
}

async function getTableRows(tableName: string): Promise<Record<string, unknown>[]> {
  return query<Record<string, unknown>[]>(`SELECT * FROM \`${tableName}\``);
}

async function getCreateTableSQL(tableName: string): Promise<string> {
  const rows = await query<{ 'Create Table': string }[]>(`SHOW CREATE TABLE \`${tableName}\``);
  return rows[0]?.['Create Table'] ?? '';
}

// ─── Build SQL dump for one or all tables ────────────────────────────────────

async function buildSQLDump(tables: string[]): Promise<string> {
  const lines: string[] = [];
  const now = new Date().toISOString();

  lines.push('-- ─────────────────────────────────────────────────────────────');
  lines.push(`-- Database Export — workwala`);
  lines.push(`-- Generated: ${now}`);
  lines.push(`-- Tables: ${tables.join(', ')}`);
  lines.push('-- ─────────────────────────────────────────────────────────────');
  lines.push('');
  lines.push('SET FOREIGN_KEY_CHECKS=0;');
  lines.push('SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";');
  lines.push('SET time_zone="+05:30"; -- IST (Asia/Kolkata)');
  lines.push('');

  for (const table of tables) {
    lines.push(`-- ── Table: \`${table}\` ──────────────────────────────────────`);
    lines.push('');

    // CREATE TABLE
    const createSQL = await getCreateTableSQL(table);
    lines.push(`DROP TABLE IF EXISTS \`${table}\`;`);
    lines.push(`${createSQL};`);
    lines.push('');

    // INSERT rows
    const rows = await getTableRows(table);
    if (rows.length > 0) {
      const cols = Object.keys(rows[0]).map((c) => `\`${c}\``).join(', ');
      lines.push(`-- Data for table \`${table}\` (${rows.length} row${rows.length !== 1 ? 's' : ''})`);
      lines.push(`LOCK TABLES \`${table}\` WRITE;`);
      lines.push(`/*!40000 ALTER TABLE \`${table}\` DISABLE KEYS */;`);

      // Batch inserts (100 rows at a time)
      const BATCH = 100;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const values = batch
          .map((row) => `(${Object.values(row).map(escapeSQL).join(', ')})`)
          .join(',\n  ');
        lines.push(`INSERT INTO \`${table}\` (${cols}) VALUES`);
        lines.push(`  ${values};`);
      }

      lines.push(`/*!40000 ALTER TABLE \`${table}\` ENABLE KEYS */;`);
      lines.push(`UNLOCK TABLES;`);
    } else {
      lines.push(`-- (no rows)`);
    }
    lines.push('');
  }

  lines.push('SET FOREIGN_KEY_CHECKS=1;');
  lines.push('');
  lines.push(`-- End of export`);

  return lines.join('\n');
}

// ─── Build structure-only SQL dump (no data) ─────────────────────────────────

async function buildStructureDump(tables: string[]): Promise<string> {
  const lines: string[] = [];
  const now = new Date().toISOString();

  lines.push('-- ─────────────────────────────────────────────────────────────');
  lines.push(`-- Database Structure Export — workwala`);
  lines.push(`-- Generated: ${now}`);
  lines.push(`-- Tables: ${tables.join(', ')}`);
  lines.push('-- Structure only — no data rows included');
  lines.push('-- ─────────────────────────────────────────────────────────────');
  lines.push('');
  lines.push('SET FOREIGN_KEY_CHECKS=0;');
  lines.push('SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";');
  lines.push('SET time_zone="+05:30"; -- IST (Asia/Kolkata)');
  lines.push('');

  for (const table of tables) {
    lines.push(`-- ── Table: \`${table}\` ──────────────────────────────────────`);
    lines.push('');

    const createSQL = await getCreateTableSQL(table);
    lines.push(`DROP TABLE IF EXISTS \`${table}\`;`);
    lines.push(`${createSQL};`);
    lines.push('');
  }

  lines.push('SET FOREIGN_KEY_CHECKS=1;');
  lines.push('');
  lines.push(`-- End of structure export`);

  return lines.join('\n');
}

// ─── Build CSV for a single table ────────────────────────────────────────────

async function buildCSV(tableName: string): Promise<string> {
  const columns = await getTableColumns(tableName);
  const rows = await getTableRows(tableName);

  const header = columns.map(escapeCSV).join(',');
  const dataRows = rows.map((row) =>
    columns.map((col) => escapeCSV(row[col])).join(',')
  );

  return [header, ...dataRows].join('\r\n');
}

// ─── GET /api/admin/settings/db-export ───────────────────────────────────────
// Query params:
//   format=sql|structure|csv  (default: sql)
//   table=<name>              (optional; if omitted → all tables for sql/structure, required for csv)

export async function GET(req: NextRequest) {
  const { error, user: actor } = await requirePermission(req, 'settings.edit');
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get('format') || 'sql').toLowerCase();
  const tableParam = searchParams.get('table') || '';

  // Validate table name if provided
  if (tableParam && !EXPORTABLE_TABLES.includes(tableParam)) {
    return NextResponse.json({ error: 'Unknown table name' }, { status: 400 });
  }

  try {
    if (format === 'csv') {
      if (!tableParam) {
        return NextResponse.json({ error: 'table param required for CSV export' }, { status: 400 });
      }

      const csv = await buildCSV(tableParam);
      const filename = `${tableParam}_${Date.now()}.csv`;

      await logActivity({
        userId: actor!.userId,
        userName: actor!.email,
        action: 'Exported',
        module: 'settings',
        description: `Exported table \`${tableParam}\` as CSV`,
        ipAddress: getClientIp(req),
      });

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    if (format === 'structure') {
      const tables = tableParam ? [tableParam] : EXPORTABLE_TABLES;
      const sql = await buildStructureDump(tables);
      const filename = tableParam
        ? `${tableParam}_structure_${Date.now()}.sql`
        : `workwala_structure_${Date.now()}.sql`;

      await logActivity({
        userId: actor!.userId,
        userName: actor!.email,
        action: 'Exported',
        module: 'settings',
        description: tableParam
          ? `Exported structure of table \`${tableParam}\``
          : `Exported full database structure (${tables.length} tables)`,
        ipAddress: getClientIp(req),
      });

      return new NextResponse(sql, {
        status: 200,
        headers: {
          'Content-Type': 'application/sql; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Default: full SQL dump (structure + data)
    const tables = tableParam ? [tableParam] : EXPORTABLE_TABLES;
    const sql = await buildSQLDump(tables);
    const filename = tableParam
      ? `${tableParam}_${Date.now()}.sql`
      : `workwala_${Date.now()}.sql`;

    await logActivity({
      userId: actor!.userId,
      userName: actor!.email,
      action: 'Exported',
      module: 'settings',
      description: tableParam
        ? `Exported table \`${tableParam}\` as SQL`
        : `Exported full database as SQL (${tables.length} tables)`,
      ipAddress: getClientIp(req),
    });

    return new NextResponse(sql, {
      status: 200,
      headers: {
        'Content-Type': 'application/sql; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('DB Export error:', err);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

// ─── POST /api/admin/settings/db-export ──────────────────────────────────────
// Returns table list + row counts (used by the UI to populate the table picker)

export async function POST(req: NextRequest) {
  const { error } = await requirePermission(req, 'settings.edit');
  if (error) return error;

  try {
    const tableStats: { name: string; rows: number }[] = [];

    for (const table of EXPORTABLE_TABLES) {
      const result = await query<{ cnt: number }[]>(
        `SELECT COUNT(*) AS cnt FROM \`${table}\``
      );
      tableStats.push({ name: table, rows: result[0]?.cnt ?? 0 });
    }

    return NextResponse.json({ tables: tableStats });
  } catch (err) {
    console.error('DB Export stats error:', err);
    return NextResponse.json({ error: 'Failed to load table stats' }, { status: 500 });
  }
}
