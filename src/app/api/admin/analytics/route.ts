import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/apiAuth';
import { query } from '@/lib/db';

// Strict YYYY-MM-DD validator — prevents SQL injection via date params.
function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
}

// MySQL COUNT(*) returns BigInt via mysql2 — always cast with Number()
function n(row: { count: unknown }): number {
  return Number(row?.count ?? 0);
}

// ── GET /api/admin/analytics ─────────────────────────────────────────────────
// Query params:
//   ?days=7|30|90          → last N days window (default 30)
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD → custom range
export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, 'dashboard.view');
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const daysParam = searchParams.get('days');
    const fromParam = searchParams.get('from');
    const toParam   = searchParams.get('to');

    // Resolve date window — all date values go through parameterized queries to prevent SQL injection.
    let days = 30;
    // useCustomRange: when true, dateFrom/dateTo are YYYY-MM-DD strings passed as ? params.
    // When false, the SQL uses DATE_SUB(CURDATE(), INTERVAL N DAY) / CURDATE() inline (safe — N is a validated integer).
    let useCustomRange = false;
    let dateFrom = '';
    let dateTo   = '';

    if (fromParam && toParam) {
      // Strict YYYY-MM-DD validation — reject anything that isn't a real date
      if (!isValidDate(fromParam) || !isValidDate(toParam)) {
        return NextResponse.json({ error: 'Invalid date range. Use YYYY-MM-DD format.' }, { status: 400 });
      }
      const fromDate = new Date(fromParam);
      const toDate   = new Date(toParam);
      if (toDate < fromDate) {
        return NextResponse.json({ error: 'to date must be >= from date' }, { status: 400 });
      }
      dateFrom       = fromParam;
      dateTo         = toParam;
      useCustomRange = true;
      days = Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / 86400000) + 1);
    } else {
      // days is a validated integer — safe to interpolate into SQL
      days = daysParam ? Math.min(Math.max(parseInt(daysParam) || 30, 1), 365) : 30;
    }

    // Helper: build a parameterized BETWEEN clause for DATE(col).
    // Returns { sql: string, params: string[] } — append params to your query params array.
    function dateBetween(col: string): { sql: string; params: string[] } {
      if (useCustomRange) {
        return { sql: `DATE(${col}) BETWEEN ? AND ?`, params: [dateFrom, dateTo] };
      }
      return {
        sql: `DATE(${col}) BETWEEN DATE_SUB(CURDATE(), INTERVAL ${days - 1} DAY) AND CURDATE()`,
        params: [],
      };
    }

    // ── Summary counts ───────────────────────────────────────────────────────
    const [totalUsers]       = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL`);
    const [activeUsers]      = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL AND status = 'active'`);
    const [inactiveUsers]    = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL AND status = 'inactive'`);
    const [bannedUsers]      = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL AND status = 'banned'`);
    const [totalCustomers]   = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM customers WHERE deleted_at IS NULL`);
    const [totalPartners]    = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM partners WHERE deleted_at IS NULL`);
    const [approvedPartners] = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM partners WHERE deleted_at IS NULL AND status = 'approved'`);
    const [pendingPartners]  = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM partners WHERE deleted_at IS NULL AND status = 'pending'`);
    const [totalBookings]    = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM bookings WHERE deleted_at IS NULL`);
    const [completedBookings]= await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM bookings WHERE deleted_at IS NULL AND status = 'completed'`);
    const [cancelledBookings]= await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM bookings WHERE deleted_at IS NULL AND status = 'cancelled'`);
    const [totalServices]    = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM services WHERE deleted_at IS NULL`);
    const [totalCategories]  = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM categories WHERE deleted_at IS NULL`);
    const [totalPages]       = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM pages WHERE deleted_at IS NULL`);
    const [publishedPages]   = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM pages WHERE deleted_at IS NULL AND status = 'published'`);
    const [draftPages]       = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM pages WHERE deleted_at IS NULL AND status = 'draft'`);
    const [totalRoles]       = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM roles WHERE deleted_at IS NULL`);
    const [totalPermissions] = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM permissions WHERE deleted_at IS NULL`);
    const [totalLogs]        = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM activity_logs WHERE deleted_at IS NULL`);
    const [logsToday]        = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM activity_logs WHERE deleted_at IS NULL AND DATE(created_at) = CURDATE()`);
    const [pendingDeletes]   = await query<{ count: unknown }[]>(`SELECT COUNT(*) as count FROM delete_account_requests WHERE status = 'pending' AND deleted_at IS NULL`);

    // ── Revenue ──────────────────────────────────────────────────────────────
    const [revenueRow] = await query<{ total: unknown }[]>(`SELECT COALESCE(SUM(total_price), 0) as total FROM bookings WHERE deleted_at IS NULL AND status = 'completed'`);
    const [avgBookingRow] = await query<{ avg: unknown }[]>(`SELECT COALESCE(AVG(total_price), 0) as avg FROM bookings WHERE deleted_at IS NULL`);

    // ── Period-scoped counts ─────────────────────────────────────────────────
    const bip = dateBetween('created_at');
    const [bookingsInPeriod] = await query<{ count: unknown }[]>(
      `SELECT COUNT(*) as count FROM bookings WHERE deleted_at IS NULL AND ${bip.sql}`,
      bip.params
    );
    const [customersInPeriod] = await query<{ count: unknown }[]>(
      `SELECT COUNT(*) as count FROM customers WHERE deleted_at IS NULL AND ${bip.sql}`,
      bip.params
    );
    const [partnersInPeriod] = await query<{ count: unknown }[]>(
      `SELECT COUNT(*) as count FROM partners WHERE deleted_at IS NULL AND ${bip.sql}`,
      bip.params
    );

    // ── This week vs last week ────────────────────────────────────────────────
    const [bookingsThisWeek] = await query<{ count: unknown }[]>(`
      SELECT COUNT(*) as count FROM bookings WHERE deleted_at IS NULL AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    `);
    const [bookingsLastWeek] = await query<{ count: unknown }[]>(`
      SELECT COUNT(*) as count FROM bookings WHERE deleted_at IS NULL
        AND created_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
        AND created_at <  DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    `);
    const [customersThisWeek] = await query<{ count: unknown }[]>(`
      SELECT COUNT(*) as count FROM customers WHERE deleted_at IS NULL AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    `);
    const [logsThisWeek] = await query<{ count: unknown }[]>(`
      SELECT COUNT(*) as count FROM activity_logs WHERE deleted_at IS NULL AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    `);
    const [logsLastWeek] = await query<{ count: unknown }[]>(`
      SELECT COUNT(*) as count FROM activity_logs WHERE deleted_at IS NULL
        AND created_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
        AND created_at <  DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    `);

    // ── This month vs last month ─────────────────────────────────────────────
    const [bookingsThisMonth] = await query<{ count: unknown }[]>(`
      SELECT COUNT(*) as count FROM bookings WHERE deleted_at IS NULL
        AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())
    `);
    const [bookingsLastMonth] = await query<{ count: unknown }[]>(`
      SELECT COUNT(*) as count FROM bookings WHERE deleted_at IS NULL
        AND YEAR(created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
        AND MONTH(created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
    `);

    // ── Bookings per day (in selected period) ────────────────────────────────
    const bookingGrowth = await query<{ day: string; count: unknown }[]>(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as day, COUNT(*) as count
       FROM bookings
       WHERE deleted_at IS NULL AND ${bip.sql}
       GROUP BY day ORDER BY day ASC`,
      bip.params
    );

    // ── Customers registered per day (in selected period) ────────────────────
    const customerGrowth = await query<{ day: string; count: unknown }[]>(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as day, COUNT(*) as count
       FROM customers
       WHERE deleted_at IS NULL AND ${bip.sql}
       GROUP BY day ORDER BY day ASC`,
      bip.params
    );

    // ── Partners registered per day (in selected period) ─────────────────────
    const partnerGrowth = await query<{ day: string; count: unknown }[]>(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as day, COUNT(*) as count
       FROM partners
       WHERE deleted_at IS NULL AND ${bip.sql}
       GROUP BY day ORDER BY day ASC`,
      bip.params
    );

    // ── Activity logs per day (in selected period) ───────────────────────────
    const activityGrowth = await query<{ day: string; count: unknown }[]>(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as day, COUNT(*) as count
       FROM activity_logs
       WHERE deleted_at IS NULL AND ${bip.sql}
       GROUP BY day ORDER BY day ASC`,
      bip.params
    );

    // ── Bookings by status ───────────────────────────────────────────────────
    const bookingsByStatus = await query<{ status: string; count: unknown }[]>(`
      SELECT status, COUNT(*) as count
      FROM bookings
      WHERE deleted_at IS NULL
      GROUP BY status
      ORDER BY count DESC
    `);

    // ── Bookings by service ──────────────────────────────────────────────────
    const bookingsByService = await query<{ service: string; count: unknown; revenue: unknown }[]>(`
      SELECT s.name as service, COUNT(b.id) as count, COALESCE(SUM(b.total_price), 0) as revenue
      FROM bookings b
      JOIN services s ON b.service_id = s.id
      WHERE b.deleted_at IS NULL
      GROUP BY b.service_id, s.name
      ORDER BY count DESC
    `);

    // ── Partners by status ───────────────────────────────────────────────────
    const partnersByStatus = await query<{ status: string; count: unknown }[]>(`
      SELECT status, COUNT(*) as count
      FROM partners
      WHERE deleted_at IS NULL
      GROUP BY status
      ORDER BY count DESC
    `);

    // ── Customers by status — customers table has no status col, so we use a synthetic "registered" label ──
    const customersByStatus = await query<{ status: string; count: unknown }[]>(`
      SELECT 'registered' as status, COUNT(*) as count
      FROM customers
      WHERE deleted_at IS NULL
    `);

    // ── Users by country (reverse-geocode lat/lng via bounding boxes) ────────
    const usersByCountry = await query<{ code: string; country: string; count: unknown }[]>(`
      SELECT
        CASE
          WHEN lat BETWEEN 8.4  AND 37.6  AND lng BETWEEN 68.7  AND 97.4  THEN 'IN'
          WHEN lat BETWEEN 24.4 AND 49.4  AND lng BETWEEN -125.0 AND -66.9 THEN 'US'
          WHEN lat BETWEEN 49.0 AND 83.0  AND lng BETWEEN -141.0 AND -52.6 THEN 'CA'
          WHEN lat BETWEEN -43.6 AND -10.0 AND lng BETWEEN 113.3 AND 153.6 THEN 'AU'
          WHEN lat BETWEEN 18.0 AND 53.6  AND lng BETWEEN 73.6  AND 135.1 THEN 'CN'
          WHEN lat BETWEEN 30.0 AND 45.5  AND lng BETWEEN 129.5 AND 145.8 THEN 'JP'
          WHEN lat BETWEEN 33.6 AND 38.6  AND lng BETWEEN 125.9 AND 129.6 THEN 'KR'
          WHEN lat BETWEEN 35.8 AND 71.2  AND lng BETWEEN -9.5  AND 40.2  THEN 'GB'
          WHEN lat BETWEEN 47.3 AND 55.1  AND lng BETWEEN 5.9   AND 15.0  THEN 'DE'
          WHEN lat BETWEEN 41.3 AND 51.1  AND lng BETWEEN -4.8  AND 8.2   THEN 'FR'
          WHEN lat BETWEEN 36.0 AND 47.1  AND lng BETWEEN 6.6   AND 18.5  THEN 'IT'
          WHEN lat BETWEEN 36.0 AND 43.8  AND lng BETWEEN -9.3  AND 4.3   THEN 'ES'
          WHEN lat BETWEEN -33.9 AND 4.8  AND lng BETWEEN -73.9 AND -28.8 THEN 'BR'
          WHEN lat BETWEEN 14.5 AND 32.7  AND lng BETWEEN -118.4 AND -86.7 THEN 'MX'
          WHEN lat BETWEEN 23.6 AND 37.1  AND lng BETWEEN 44.0  AND 63.3  THEN 'SA'
          WHEN lat BETWEEN 22.0 AND 37.3  AND lng BETWEEN 34.2  AND 55.7  THEN 'AE'
          WHEN lat BETWEEN 51.2 AND 71.0  AND lng BETWEEN 19.0  AND 180.0 THEN 'RU'
          WHEN lat BETWEEN 5.9  AND 37.1  AND lng BETWEEN -5.5  AND 15.0  THEN 'NG'
          WHEN lat BETWEEN -34.8 AND -22.0 AND lng BETWEEN 16.5 AND 32.9  THEN 'ZA'
          WHEN lat BETWEEN 20.6 AND 37.3  AND lng BETWEEN 24.7  AND 37.0  THEN 'EG'
          WHEN lat BETWEEN 5.6  AND 28.5  AND lng BETWEEN 97.3  AND 141.0 THEN 'ID'
          WHEN lat BETWEEN 1.3  AND 6.7   AND lng BETWEEN 99.6  AND 119.3 THEN 'MY'
          WHEN lat BETWEEN 1.1  AND 1.5   AND lng BETWEEN 103.6 AND 104.0 THEN 'SG'
          WHEN lat BETWEEN 5.6  AND 21.1  AND lng BETWEEN 117.2 AND 126.6 THEN 'PH'
          WHEN lat BETWEEN 8.6  AND 23.5  AND lng BETWEEN 97.3  AND 105.6 THEN 'TH'
          WHEN lat BETWEEN 8.4  AND 23.4  AND lng BETWEEN 102.1 AND 109.5 THEN 'VN'
          WHEN lat BETWEEN 25.1 AND 31.6  AND lng BETWEEN 32.1  AND 34.9  THEN 'IL'
          WHEN lat BETWEEN 29.3 AND 37.4  AND lng BETWEEN 34.6  AND 42.4  THEN 'JO'
          WHEN lat BETWEEN 36.0 AND 42.1  AND lng BETWEEN 26.0  AND 44.8  THEN 'TR'
          WHEN lat BETWEEN 50.0 AND 54.6  AND lng BETWEEN -10.5 AND -5.3  THEN 'IE'
          WHEN lat BETWEEN 55.3 AND 57.8  AND lng BETWEEN 8.1   AND 15.2  THEN 'DK'
          WHEN lat BETWEEN 55.3 AND 71.2  AND lng BETWEEN 4.6   AND 31.1  THEN 'NO'
          WHEN lat BETWEEN 55.3 AND 69.1  AND lng BETWEEN 11.1  AND 24.2  THEN 'SE'
          WHEN lat BETWEEN 59.8 AND 70.1  AND lng BETWEEN 20.6  AND 31.6  THEN 'FI'
          WHEN lat BETWEEN 45.8 AND 47.8  AND lng BETWEEN 5.9   AND 10.5  THEN 'CH'
          WHEN lat BETWEEN 46.4 AND 49.0  AND lng BETWEEN 9.5   AND 17.2  THEN 'AT'
          WHEN lat BETWEEN 49.5 AND 51.5  AND lng BETWEEN 2.5   AND 6.4   THEN 'BE'
          WHEN lat BETWEEN 50.8 AND 53.5  AND lng BETWEEN 3.4   AND 7.2   THEN 'NL'
          WHEN lat BETWEEN 49.0 AND 54.9  AND lng BETWEEN 14.1  AND 24.2  THEN 'PL'
          WHEN lat BETWEEN -55.0 AND -17.5 AND lng BETWEEN -75.7 AND -53.6 THEN 'AR'
          WHEN lat BETWEEN -56.5 AND 12.5  AND lng BETWEEN -81.4 AND -66.9 THEN 'CO'
          WHEN lat BETWEEN -18.4 AND 0.0  AND lng BETWEEN -81.3 AND -68.7 THEN 'PE'
          WHEN lat BETWEEN 22.0 AND 37.0  AND lng BETWEEN -17.0 AND -1.0  THEN 'MA'
          WHEN lat BETWEEN 30.2 AND 37.3  AND lng BETWEEN 7.5   AND 11.6  THEN 'TN'
          WHEN lat BETWEEN 19.0 AND 37.3  AND lng BETWEEN -5.6  AND 11.9  THEN 'DZ'
          WHEN lat BETWEEN 22.0 AND 31.7  AND lng BETWEEN 25.0  AND 36.9  THEN 'SD'
          WHEN lat BETWEEN 24.1 AND 37.5  AND lng BETWEEN 44.7  AND 60.0  THEN 'IR'
          WHEN lat BETWEEN 29.1 AND 37.4  AND lng BETWEEN 38.8  AND 48.6  THEN 'IQ'
          WHEN lat BETWEEN 33.1 AND 37.4  AND lng BETWEEN 35.7  AND 42.4  THEN 'SY'
          WHEN lat BETWEEN 33.1 AND 37.1  AND lng BETWEEN 35.1  AND 36.6  THEN 'LB'
          WHEN lat BETWEEN 24.7 AND 32.2  AND lng BETWEEN 32.1  AND 39.3  THEN 'PK'
          WHEN lat BETWEEN -47.0 AND -17.0 AND lng BETWEEN 166.4 AND 178.6 THEN 'NZ'
          ELSE 'OTHER'
        END AS code,
        CASE
          WHEN lat BETWEEN 8.4  AND 37.6  AND lng BETWEEN 68.7  AND 97.4  THEN 'India'
          WHEN lat BETWEEN 24.4 AND 49.4  AND lng BETWEEN -125.0 AND -66.9 THEN 'United States'
          WHEN lat BETWEEN 49.0 AND 83.0  AND lng BETWEEN -141.0 AND -52.6 THEN 'Canada'
          WHEN lat BETWEEN -43.6 AND -10.0 AND lng BETWEEN 113.3 AND 153.6 THEN 'Australia'
          WHEN lat BETWEEN 18.0 AND 53.6  AND lng BETWEEN 73.6  AND 135.1 THEN 'China'
          WHEN lat BETWEEN 30.0 AND 45.5  AND lng BETWEEN 129.5 AND 145.8 THEN 'Japan'
          WHEN lat BETWEEN 33.6 AND 38.6  AND lng BETWEEN 125.9 AND 129.6 THEN 'South Korea'
          WHEN lat BETWEEN 35.8 AND 71.2  AND lng BETWEEN -9.5  AND 40.2  THEN 'United Kingdom'
          WHEN lat BETWEEN 47.3 AND 55.1  AND lng BETWEEN 5.9   AND 15.0  THEN 'Germany'
          WHEN lat BETWEEN 41.3 AND 51.1  AND lng BETWEEN -4.8  AND 8.2   THEN 'France'
          WHEN lat BETWEEN 36.0 AND 47.1  AND lng BETWEEN 6.6   AND 18.5  THEN 'Italy'
          WHEN lat BETWEEN 36.0 AND 43.8  AND lng BETWEEN -9.3  AND 4.3   THEN 'Spain'
          WHEN lat BETWEEN -33.9 AND 4.8  AND lng BETWEEN -73.9 AND -28.8 THEN 'Brazil'
          WHEN lat BETWEEN 14.5 AND 32.7  AND lng BETWEEN -118.4 AND -86.7 THEN 'Mexico'
          WHEN lat BETWEEN 23.6 AND 37.1  AND lng BETWEEN 44.0  AND 63.3  THEN 'Saudi Arabia'
          WHEN lat BETWEEN 22.0 AND 37.3  AND lng BETWEEN 34.2  AND 55.7  THEN 'United Arab Emirates'
          WHEN lat BETWEEN 51.2 AND 71.0  AND lng BETWEEN 19.0  AND 180.0 THEN 'Russia'
          WHEN lat BETWEEN 5.9  AND 37.1  AND lng BETWEEN -5.5  AND 15.0  THEN 'Nigeria'
          WHEN lat BETWEEN -34.8 AND -22.0 AND lng BETWEEN 16.5 AND 32.9  THEN 'South Africa'
          WHEN lat BETWEEN 20.6 AND 37.3  AND lng BETWEEN 24.7  AND 37.0  THEN 'Egypt'
          WHEN lat BETWEEN 5.6  AND 28.5  AND lng BETWEEN 97.3  AND 141.0 THEN 'Indonesia'
          WHEN lat BETWEEN 1.3  AND 6.7   AND lng BETWEEN 99.6  AND 119.3 THEN 'Malaysia'
          WHEN lat BETWEEN 1.1  AND 1.5   AND lng BETWEEN 103.6 AND 104.0 THEN 'Singapore'
          WHEN lat BETWEEN 5.6  AND 21.1  AND lng BETWEEN 117.2 AND 126.6 THEN 'Philippines'
          WHEN lat BETWEEN 8.6  AND 23.5  AND lng BETWEEN 97.3  AND 105.6 THEN 'Thailand'
          WHEN lat BETWEEN 8.4  AND 23.4  AND lng BETWEEN 102.1 AND 109.5 THEN 'Vietnam'
          WHEN lat BETWEEN 25.1 AND 31.6  AND lng BETWEEN 32.1  AND 34.9  THEN 'Israel'
          WHEN lat BETWEEN 29.3 AND 37.4  AND lng BETWEEN 34.6  AND 42.4  THEN 'Jordan'
          WHEN lat BETWEEN 36.0 AND 42.1  AND lng BETWEEN 26.0  AND 44.8  THEN 'Turkey'
          WHEN lat BETWEEN 50.0 AND 54.6  AND lng BETWEEN -10.5 AND -5.3  THEN 'Ireland'
          WHEN lat BETWEEN 55.3 AND 57.8  AND lng BETWEEN 8.1   AND 15.2  THEN 'Denmark'
          WHEN lat BETWEEN 55.3 AND 71.2  AND lng BETWEEN 4.6   AND 31.1  THEN 'Norway'
          WHEN lat BETWEEN 55.3 AND 69.1  AND lng BETWEEN 11.1  AND 24.2  THEN 'Sweden'
          WHEN lat BETWEEN 59.8 AND 70.1  AND lng BETWEEN 20.6  AND 31.6  THEN 'Finland'
          WHEN lat BETWEEN 45.8 AND 47.8  AND lng BETWEEN 5.9   AND 10.5  THEN 'Switzerland'
          WHEN lat BETWEEN 46.4 AND 49.0  AND lng BETWEEN 9.5   AND 17.2  THEN 'Austria'
          WHEN lat BETWEEN 49.5 AND 51.5  AND lng BETWEEN 2.5   AND 6.4   THEN 'Belgium'
          WHEN lat BETWEEN 50.8 AND 53.5  AND lng BETWEEN 3.4   AND 7.2   THEN 'Netherlands'
          WHEN lat BETWEEN 49.0 AND 54.9  AND lng BETWEEN 14.1  AND 24.2  THEN 'Poland'
          WHEN lat BETWEEN -55.0 AND -17.5 AND lng BETWEEN -75.7 AND -53.6 THEN 'Argentina'
          WHEN lat BETWEEN -56.5 AND 12.5  AND lng BETWEEN -81.4 AND -66.9 THEN 'Colombia'
          WHEN lat BETWEEN -18.4 AND 0.0  AND lng BETWEEN -81.3 AND -68.7 THEN 'Peru'
          WHEN lat BETWEEN 22.0 AND 37.0  AND lng BETWEEN -17.0 AND -1.0  THEN 'Morocco'
          WHEN lat BETWEEN 30.2 AND 37.3  AND lng BETWEEN 7.5   AND 11.6  THEN 'Tunisia'
          WHEN lat BETWEEN 19.0 AND 37.3  AND lng BETWEEN -5.6  AND 11.9  THEN 'Algeria'
          WHEN lat BETWEEN 22.0 AND 31.7  AND lng BETWEEN 25.0  AND 36.9  THEN 'Sudan'
          WHEN lat BETWEEN 24.1 AND 37.5  AND lng BETWEEN 44.7  AND 60.0  THEN 'Iran'
          WHEN lat BETWEEN 29.1 AND 37.4  AND lng BETWEEN 38.8  AND 48.6  THEN 'Iraq'
          WHEN lat BETWEEN 33.1 AND 37.4  AND lng BETWEEN 35.7  AND 42.4  THEN 'Syria'
          WHEN lat BETWEEN 33.1 AND 37.1  AND lng BETWEEN 35.1  AND 36.6  THEN 'Lebanon'
          WHEN lat BETWEEN 24.7 AND 32.2  AND lng BETWEEN 32.1  AND 39.3  THEN 'Pakistan'
          WHEN lat BETWEEN -47.0 AND -17.0 AND lng BETWEEN 166.4 AND 178.6 THEN 'New Zealand'
          ELSE 'Other'
        END AS country,
        COUNT(*) as count
      FROM partners
      WHERE lat IS NOT NULL AND lng IS NOT NULL AND deleted_at IS NULL
      GROUP BY code, country
      HAVING code != 'OTHER'
      ORDER BY count DESC
    `);

    // ── Top cities (reverse-geocode lat/lng to city via bounding boxes) ──────
    const topCities = await query<{ city: string; country: string; count: unknown }[]>(`
      SELECT
        CASE
          WHEN lat BETWEEN 28.4  AND 28.9  AND lng BETWEEN 76.8  AND 77.4  THEN 'New Delhi'
          WHEN lat BETWEEN 18.8  AND 19.3  AND lng BETWEEN 72.7  AND 73.1  THEN 'Mumbai'
          WHEN lat BETWEEN 12.8  AND 13.2  AND lng BETWEEN 77.4  AND 77.8  THEN 'Bangalore'
          WHEN lat BETWEEN 22.4  AND 22.7  AND lng BETWEEN 88.2  AND 88.5  THEN 'Kolkata'
          WHEN lat BETWEEN 17.2  AND 17.6  AND lng BETWEEN 78.3  AND 78.7  THEN 'Hyderabad'
          WHEN lat BETWEEN 12.9  AND 13.2  AND lng BETWEEN 80.1  AND 80.4  THEN 'Chennai'
          WHEN lat BETWEEN 22.9  AND 23.2  AND lng BETWEEN 72.5  AND 72.8  THEN 'Ahmedabad'
          WHEN lat BETWEEN 18.4  AND 18.7  AND lng BETWEEN 73.7  AND 74.0  THEN 'Pune'
          WHEN lat BETWEEN 26.8  AND 27.0  AND lng BETWEEN 80.8  AND 81.1  THEN 'Lucknow'
          WHEN lat BETWEEN 21.1  AND 21.3  AND lng BETWEEN 81.5  AND 81.8  THEN 'Raipur'
          WHEN lat BETWEEN 37.6  AND 37.9  AND lng BETWEEN -122.5 AND -122.3 THEN 'San Francisco'
          WHEN lat BETWEEN 34.0  AND 34.2  AND lng BETWEEN -118.4 AND -118.1 THEN 'Los Angeles'
          WHEN lat BETWEEN 40.6  AND 40.9  AND lng BETWEEN -74.1  AND -73.8  THEN 'New York'
          WHEN lat BETWEEN 41.7  AND 42.0  AND lng BETWEEN -87.8  AND -87.5  THEN 'Chicago'
          WHEN lat BETWEEN 29.6  AND 29.9  AND lng BETWEEN -95.5  AND -95.2  THEN 'Houston'
          WHEN lat BETWEEN 33.3  AND 33.6  AND lng BETWEEN -112.2 AND -111.8 THEN 'Phoenix'
          WHEN lat BETWEEN 51.4  AND 51.6  AND lng BETWEEN -0.3   AND 0.1   THEN 'London'
          WHEN lat BETWEEN 48.7  AND 49.0  AND lng BETWEEN 2.2    AND 2.5   THEN 'Paris'
          WHEN lat BETWEEN 52.4  AND 52.6  AND lng BETWEEN 13.3   AND 13.6  THEN 'Berlin'
          WHEN lat BETWEEN 41.0  AND 41.2  AND lng BETWEEN 28.8   AND 29.2  THEN 'Istanbul'
          WHEN lat BETWEEN 55.6  AND 55.9  AND lng BETWEEN 37.4   AND 37.8  THEN 'Moscow'
          WHEN lat BETWEEN 35.6  AND 35.8  AND lng BETWEEN 139.6  AND 139.8 THEN 'Tokyo'
          WHEN lat BETWEEN 31.1  AND 31.3  AND lng BETWEEN 121.3  AND 121.6 THEN 'Shanghai'
          WHEN lat BETWEEN 39.8  AND 40.1  AND lng BETWEEN 116.2  AND 116.6 THEN 'Beijing'
          WHEN lat BETWEEN 22.2  AND 22.4  AND lng BETWEEN 114.0  AND 114.3 THEN 'Hong Kong'
          WHEN lat BETWEEN 1.2   AND 1.5   AND lng BETWEEN 103.7  AND 104.0 THEN 'Singapore'
          WHEN lat BETWEEN -33.9 AND -33.8 AND lng BETWEEN 151.1  AND 151.3 THEN 'Sydney'
          WHEN lat BETWEEN -37.9 AND -37.7 AND lng BETWEEN 144.8  AND 145.1 THEN 'Melbourne'
          WHEN lat BETWEEN 25.1  AND 25.3  AND lng BETWEEN 55.2   AND 55.5  THEN 'Dubai'
          WHEN lat BETWEEN 24.6  AND 24.8  AND lng BETWEEN 46.6   AND 46.9  THEN 'Riyadh'
          WHEN lat BETWEEN 30.0  AND 30.2  AND lng BETWEEN 31.1   AND 31.4  THEN 'Cairo'
          WHEN lat BETWEEN -23.6 AND -23.4 AND lng BETWEEN -46.8  AND -46.5 THEN 'São Paulo'
          WHEN lat BETWEEN -22.9 AND -22.8 AND lng BETWEEN -43.3  AND -43.1 THEN 'Rio de Janeiro'
          WHEN lat BETWEEN 19.3  AND 19.5  AND lng BETWEEN -99.2  AND -98.9 THEN 'Mexico City'
          WHEN lat BETWEEN 6.4   AND 6.6   AND lng BETWEEN 3.3    AND 3.5   THEN 'Lagos'
          WHEN lat BETWEEN -26.3 AND -26.1 AND lng BETWEEN 27.9   AND 28.2  THEN 'Johannesburg'
          WHEN lat BETWEEN 3.0   AND 3.3   AND lng BETWEEN 101.5  AND 101.8 THEN 'Kuala Lumpur'
          WHEN lat BETWEEN 13.6  AND 13.9  AND lng BETWEEN 100.4  AND 100.7 THEN 'Bangkok'
          WHEN lat BETWEEN 10.7  AND 11.0  AND lng BETWEEN 106.6  AND 106.8 THEN 'Ho Chi Minh City'
          WHEN lat BETWEEN 14.5  AND 14.7  AND lng BETWEEN 121.0  AND 121.2 THEN 'Manila'
          WHEN lat BETWEEN -6.3  AND -6.1  AND lng BETWEEN 106.7  AND 106.9 THEN 'Jakarta'
          WHEN lat BETWEEN 59.8  AND 60.0  AND lng BETWEEN 30.2   AND 30.5  THEN 'St. Petersburg'
          WHEN lat BETWEEN 50.0  AND 50.2  AND lng BETWEEN 14.3   AND 14.6  THEN 'Prague'
          WHEN lat BETWEEN 47.4  AND 47.6  AND lng BETWEEN 19.0   AND 19.2  THEN 'Budapest'
          WHEN lat BETWEEN 52.2  AND 52.4  AND lng BETWEEN 20.9   AND 21.2  THEN 'Warsaw'
          WHEN lat BETWEEN 45.7  AND 45.9  AND lng BETWEEN 8.9    AND 9.3   THEN 'Milan'
          WHEN lat BETWEEN 41.8  AND 42.0  AND lng BETWEEN 12.4   AND 12.6  THEN 'Rome'
          WHEN lat BETWEEN 40.3  AND 40.5  AND lng BETWEEN -3.8   AND -3.5  THEN 'Madrid'
          WHEN lat BETWEEN 41.3  AND 41.5  AND lng BETWEEN 2.1    AND 2.3   THEN 'Barcelona'
          WHEN lat BETWEEN 53.3  AND 53.5  AND lng BETWEEN -2.3   AND -2.1  THEN 'Manchester'
          WHEN lat BETWEEN 53.7  AND 53.9  AND lng BETWEEN -1.7   AND -1.4  THEN 'Leeds'
          WHEN lat BETWEEN 43.6  AND 43.8  AND lng BETWEEN -79.5  AND -79.3 THEN 'Toronto'
          WHEN lat BETWEEN 45.4  AND 45.6  AND lng BETWEEN -73.7  AND -73.5 THEN 'Montreal'
          WHEN lat BETWEEN 49.2  AND 49.4  AND lng BETWEEN -123.3 AND -123.0 THEN 'Vancouver'
          ELSE 'Other'
        END AS city,
        CASE
          WHEN lat BETWEEN 8.4  AND 37.6  AND lng BETWEEN 68.7  AND 97.4  THEN 'India'
          WHEN lat BETWEEN 24.4 AND 49.4  AND lng BETWEEN -125.0 AND -66.9 THEN 'United States'
          WHEN lat BETWEEN 49.0 AND 83.0  AND lng BETWEEN -141.0 AND -52.6 THEN 'Canada'
          WHEN lat BETWEEN -43.6 AND -10.0 AND lng BETWEEN 113.3 AND 153.6 THEN 'Australia'
          WHEN lat BETWEEN 18.0 AND 53.6  AND lng BETWEEN 73.6  AND 135.1 THEN 'China'
          WHEN lat BETWEEN 30.0 AND 45.5  AND lng BETWEEN 129.5 AND 145.8 THEN 'Japan'
          WHEN lat BETWEEN 35.8 AND 71.2  AND lng BETWEEN -9.5  AND 40.2  THEN 'Europe'
          WHEN lat BETWEEN 51.2 AND 71.0  AND lng BETWEEN 19.0  AND 180.0 THEN 'Russia'
          WHEN lat BETWEEN 22.0 AND 37.3  AND lng BETWEEN 34.2  AND 55.7  THEN 'Middle East'
          WHEN lat BETWEEN -33.9 AND 4.8  AND lng BETWEEN -73.9 AND -28.8 THEN 'Brazil'
          WHEN lat BETWEEN 14.5 AND 32.7  AND lng BETWEEN -118.4 AND -86.7 THEN 'Mexico'
          WHEN lat BETWEEN 5.6  AND 28.5  AND lng BETWEEN 97.3  AND 141.0 THEN 'Southeast Asia'
          WHEN lat BETWEEN 1.1  AND 1.5   AND lng BETWEEN 103.6 AND 104.0 THEN 'Singapore'
          WHEN lat BETWEEN 5.9  AND 37.1  AND lng BETWEEN -5.5  AND 15.0  THEN 'Africa'
          WHEN lat BETWEEN -34.8 AND -22.0 AND lng BETWEEN 16.5 AND 32.9  THEN 'South Africa'
          WHEN lat BETWEEN 20.6 AND 37.3  AND lng BETWEEN 24.7  AND 37.0  THEN 'Egypt'
          ELSE 'Other'
        END AS country,
        COUNT(*) as count
      FROM partners
      WHERE lat IS NOT NULL AND lng IS NOT NULL AND deleted_at IS NULL
      GROUP BY city, country
      HAVING city != 'Other'
      ORDER BY count DESC
      LIMIT 20
    `);

    // ── Top pages (by activity log hits on page slugs) ────────────────────────
    const topPages = await query<{ title: string; slug: string; views: unknown }[]>(`
      SELECT
        p.title,
        p.slug,
        COUNT(al.id) as views
      FROM pages p
      LEFT JOIN activity_logs al
        ON al.deleted_at IS NULL
        AND (al.description LIKE CONCAT('%/', p.slug, '%') OR al.target_name = p.title)
      WHERE p.deleted_at IS NULL
      GROUP BY p.id, p.title, p.slug
      ORDER BY views DESC
      LIMIT 20
    `);

    // ── Activity by module ───────────────────────────────────────────────────
    const activityByModule = await query<{ module: string; count: unknown }[]>(`
      SELECT module, COUNT(*) as count
      FROM activity_logs
      WHERE deleted_at IS NULL
      GROUP BY module
      ORDER BY count DESC
    `);

    // ── Activity by action ───────────────────────────────────────────────────
    const activityByAction = await query<{ action: string; count: unknown }[]>(`
      SELECT action, COUNT(*) as count
      FROM activity_logs
      WHERE deleted_at IS NULL
      GROUP BY action
      ORDER BY count DESC
    `);

    // ── User status breakdown ────────────────────────────────────────────────
    const usersByStatus = await query<{ status: string; count: unknown }[]>(`
      SELECT status, COUNT(*) as count
      FROM users
      WHERE deleted_at IS NULL
      GROUP BY status
    `);

    // ── Pages status breakdown ───────────────────────────────────────────────
    const pagesByStatus = await query<{ status: string; count: unknown }[]>(`
      SELECT status, COUNT(*) as count
      FROM pages
      WHERE deleted_at IS NULL
      GROUP BY status
    `);

    // ── Permissions per module ───────────────────────────────────────────────
    const permissionsByModule = await query<{ module: string; count: unknown }[]>(`
      SELECT module, COUNT(*) as count
      FROM permissions
      WHERE deleted_at IS NULL
      GROUP BY module
      ORDER BY count DESC
    `);

    // ── Revenue per day (in selected period) ─────────────────────────────────
    const revenueGrowth = await query<{ day: string; revenue: unknown }[]>(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as day, COALESCE(SUM(total_price), 0) as revenue
       FROM bookings
       WHERE deleted_at IS NULL AND status = 'completed' AND ${bip.sql}
       GROUP BY day ORDER BY day ASC`,
      bip.params
    );

    return NextResponse.json({
      summary: {
        // Users (admin panel users)
        totalUsers:         n(totalUsers),
        activeUsers:        n(activeUsers),
        inactiveUsers:      n(inactiveUsers),
        bannedUsers:        n(bannedUsers),
        // Customers & Partners (app users)
        totalCustomers:     n(totalCustomers),
        totalPartners:      n(totalPartners),
        approvedPartners:   n(approvedPartners),
        pendingPartners:    n(pendingPartners),
        // Bookings
        totalBookings:      n(totalBookings),
        completedBookings:  n(completedBookings),
        cancelledBookings:  n(cancelledBookings),
        bookingsInPeriod:   n(bookingsInPeriod),
        customersInPeriod:  n(customersInPeriod),
        partnersInPeriod:   n(partnersInPeriod),
        bookingsThisWeek:   n(bookingsThisWeek),
        bookingsLastWeek:   n(bookingsLastWeek),
        bookingsThisMonth:  n(bookingsThisMonth),
        bookingsLastMonth:  n(bookingsLastMonth),
        customersThisWeek:  n(customersThisWeek),
        // Revenue
        totalRevenue:       Number(revenueRow?.total ?? 0),
        avgBookingValue:    Math.round(Number(avgBookingRow?.avg ?? 0) * 100) / 100,
        // Services & Categories
        totalServices:      n(totalServices),
        totalCategories:    n(totalCategories),
        // Pages, Roles, Permissions
        totalPages:         n(totalPages),
        publishedPages:     n(publishedPages),
        draftPages:         n(draftPages),
        totalRoles:         n(totalRoles),
        totalPermissions:   n(totalPermissions),
        // Logs
        totalLogs:          n(totalLogs),
        logsToday:          n(logsToday),
        logsThisWeek:       n(logsThisWeek),
        logsLastWeek:       n(logsLastWeek),
        pendingDeletes:     n(pendingDeletes),
        // Period info
        periodDays:         days,
      },
      // Growth series (normalised count to number)
      bookingGrowth:      bookingGrowth.map((r)    => ({ day: r.day, count: Number(r.count) })),
      customerGrowth:     customerGrowth.map((r)   => ({ day: r.day, count: Number(r.count) })),
      partnerGrowth:      partnerGrowth.map((r)    => ({ day: r.day, count: Number(r.count) })),
      activityGrowth:     activityGrowth.map((r)   => ({ day: r.day, count: Number(r.count) })),
      revenueGrowth:      revenueGrowth.map((r)    => ({ day: r.day, revenue: Number(r.revenue) })),
      // Breakdowns
      bookingsByStatus:   bookingsByStatus.map((r)  => ({ status: r.status, count: Number(r.count) })),
      bookingsByService:  bookingsByService.map((r) => ({ service: r.service, count: Number(r.count), revenue: Number(r.revenue) })),
      partnersByStatus:   partnersByStatus.map((r)  => ({ status: r.status === 'pending' ? 'requested' : r.status, count: Number(r.count) })),
      customersByStatus:  customersByStatus.map((r) => ({ status: r.status, count: Number(r.count) })),
      activityByModule:   activityByModule.map((r)  => ({ module: r.module, count: Number(r.count) })),
      activityByAction:   activityByAction.map((r)  => ({ action: r.action, count: Number(r.count) })),
      usersByStatus:      usersByStatus.map((r)     => ({ status: r.status, count: Number(r.count) })),
      pagesByStatus:      pagesByStatus.map((r)     => ({ status: r.status, count: Number(r.count) })),
      permissionsByModule:permissionsByModule.map((r) => ({ module: r.module, count: Number(r.count) })),
      usersByCountry:     usersByCountry.map((r)    => ({ code: r.code, country: r.country, count: Number(r.count) })),
      topCities:          topCities.map((r)         => ({ city: r.city, country: r.country, count: Number(r.count) })),
      topPages:           topPages.map((r)          => ({ title: r.title, slug: r.slug, views: Number(r.views) })),
    });
  } catch (err) {
    console.error('Analytics GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── DELETE /api/admin/analytics — clear all activity logs ────────────────────
export async function DELETE(req: NextRequest) {
  const { error } = await requirePermission(req, 'activity_logs.delete');
  if (error) return error;

  try {
    const result = await query<{ affectedRows: number }>(`
      UPDATE activity_logs SET deleted_at = NOW() WHERE deleted_at IS NULL
    `);
    const affected = (result as unknown as { affectedRows: number }).affectedRows ?? 0;
    return NextResponse.json({ success: true, cleared: affected });
  } catch (err) {
    console.error('Analytics DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
