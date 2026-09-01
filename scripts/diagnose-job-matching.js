#!/usr/bin/env node

/**
 * Diagnostic script to debug why partners aren't receiving job requests.
 * Checks partner status, categories, location, and booking availability.
 */

const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'workwala',
};

async function main() {
  let connection;
  try {
    console.log('\n🔍 DIAGNOSTIC: Partner Job Matching\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to database:', DB_CONFIG.database);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 1. Check partners
    console.log('📋 STEP 1: Checking Partners\n');
    const [partners] = await connection.execute(`
      SELECT id, name, phone, status, categories, lat, lng, last_seen_at, is_online,
             TIMESTAMPDIFF(MINUTE, last_seen_at, NOW()) as location_age_mins
      FROM partners 
      WHERE deleted_at IS NULL
      ORDER BY id DESC
      LIMIT 10
    `);

    if (partners.length === 0) {
      console.log('❌ No partners found in database!\n');
      return;
    }

    console.log(`Found ${partners.length} partner(s):\n`);
    for (const p of partners) {
      console.log(`Partner #${p.id}: ${p.name || p.phone}`);
      console.log(`  Status: ${p.status} ${p.status === 'approved' ? '✅' : '❌ (must be "approved")'}`);
      console.log(`  Categories: ${p.categories || 'NULL ❌'}`);
      
      let parsedCategories = [];
      try {
        parsedCategories = JSON.parse(p.categories || '[]');
      } catch (e) {
        console.log(`  ⚠️  Categories parse error: ${e.message}`);
      }
      
      if (parsedCategories.length === 0) {
        console.log(`  ❌ No categories registered - partner won't receive ANY jobs`);
      } else {
        console.log(`  ✅ Registered for: ${parsedCategories.join(', ')}`);
      }

      if (p.lat && p.lng) {
        console.log(`  Location: ${p.lat}, ${p.lng}`);
        console.log(`  Last seen: ${p.last_seen_at} (${p.location_age_mins} mins ago)`);
        if (p.location_age_mins <= 30) {
          console.log(`  ✅ Location is FRESH (< 30 mins) - distance filtering active`);
        } else {
          console.log(`  ⚠️  Location is STALE (> 30 mins) - will show ALL jobs regardless of distance`);
        }
      } else {
        console.log(`  ⚠️  No location data - will show ALL jobs`);
      }
      console.log(`  Online: ${p.is_online ? 'Yes ✅' : 'No'}\n`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 2. Check bookings
    console.log('📋 STEP 2: Checking Bookings\n');
    const [bookings] = await connection.execute(`
      SELECT 
        b.id, 
        b.status, 
        b.partner_id,
        b.address,
        b.lat,
        b.lng,
        b.created_at,
        s.name as service_name,
        cat.name as category_name,
        COALESCE(cat.name, s.name) as effective_service_name
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      LEFT JOIN categories cat ON cat.id = s.category_id AND cat.deleted_at IS NULL
      WHERE b.deleted_at IS NULL
      ORDER BY b.created_at DESC
      LIMIT 10
    `);

    if (bookings.length === 0) {
      console.log('❌ No bookings found in database!\n');
      return;
    }

    console.log(`Found ${bookings.length} booking(s):\n`);
    
    const findingBookings = bookings.filter(b => b.status === 'finding' && !b.partner_id);
    console.log(`📍 ${findingBookings.length} booking(s) with status='finding' and no partner assigned:\n`);

    if (findingBookings.length === 0) {
      console.log('❌ No available jobs! All bookings are either assigned or not in "finding" status.\n');
      console.log('Available statuses:');
      const statusCounts = {};
      bookings.forEach(b => {
        statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
      });
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`  - ${status}: ${count}`);
      });
      console.log('');
    } else {
      for (const b of findingBookings) {
        console.log(`Booking #${b.id}:`);
        console.log(`  Service: ${b.effective_service_name}`);
        console.log(`  Category: ${b.category_name || 'NULL'}`);
        console.log(`  Status: ${b.status} ✅`);
        console.log(`  Partner: ${b.partner_id || 'Unassigned ✅'}`);
        console.log(`  Address: ${b.address}`);
        console.log(`  Coordinates: ${b.lat && b.lng ? `${b.lat}, ${b.lng}` : 'NULL'}`);
        console.log(`  Created: ${b.created_at}\n`);
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 3. Check category matching
    console.log('📋 STEP 3: Category Matching Analysis\n');

    if (findingBookings.length > 0 && partners.length > 0) {
      for (const partner of partners) {
        if (partner.status !== 'approved') {
          console.log(`Partner #${partner.id} (${partner.name || partner.phone}): ❌ Status is "${partner.status}", not "approved"\n`);
          continue;
        }

        let partnerCategories = [];
        try {
          partnerCategories = JSON.parse(partner.categories || '[]');
        } catch (e) {
          console.log(`Partner #${partner.id} (${partner.name || partner.phone}): ❌ Invalid categories JSON\n`);
          continue;
        }

        if (partnerCategories.length === 0) {
          console.log(`Partner #${partner.id} (${partner.name || partner.phone}): ❌ No categories registered\n`);
          continue;
        }

        console.log(`Partner #${partner.id} (${partner.name || partner.phone}):`);
        console.log(`  Registered categories: ${partnerCategories.join(', ')}`);
        
        const matchingJobs = findingBookings.filter(b => 
          partnerCategories.includes(b.effective_service_name)
        );

        if (matchingJobs.length === 0) {
          console.log(`  ❌ NO MATCHING JOBS for this partner's categories`);
          console.log(`  Available job categories: ${[...new Set(findingBookings.map(b => b.effective_service_name))].join(', ')}`);
        } else {
          console.log(`  ✅ ${matchingJobs.length} matching job(s):`);
          matchingJobs.forEach(job => {
            console.log(`     - Booking #${job.id}: ${job.effective_service_name}`);
            
            // Check distance if both have coordinates
            if (partner.lat && partner.lng && job.lat && job.lng) {
              const distance = calculateDistance(
                parseFloat(partner.lat), 
                parseFloat(partner.lng),
                parseFloat(job.lat),
                parseFloat(job.lng)
              );
              console.log(`       Distance: ${distance.toFixed(1)} km ${distance <= 100 ? '✅' : '❌ (> 100km limit)'}`);
            } else {
              console.log(`       Distance: N/A (missing coordinates)`);
            }
          });
        }
        console.log('');
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 4. Summary
    console.log('📊 SUMMARY\n');
    
    const approvedPartners = partners.filter(p => p.status === 'approved');
    const partnersWithCategories = approvedPartners.filter(p => {
      try {
        const cats = JSON.parse(p.categories || '[]');
        return cats.length > 0;
      } catch {
        return false;
      }
    });

    console.log(`Total partners: ${partners.length}`);
    console.log(`Approved partners: ${approvedPartners.length}`);
    console.log(`Approved with categories: ${partnersWithCategories.length}`);
    console.log(`Total bookings: ${bookings.length}`);
    console.log(`Available jobs (finding + unassigned): ${findingBookings.length}\n`);

    if (findingBookings.length === 0) {
      console.log('❌ ISSUE: No bookings with status="finding" and partner_id=NULL');
      console.log('   Solution: Create a test booking from the customer app\n');
    } else if (partnersWithCategories.length === 0) {
      console.log('❌ ISSUE: No approved partners with registered categories');
      console.log('   Solution: Ensure partner profile is approved and has service categories selected\n');
    } else {
      console.log('✅ System looks configured correctly');
      console.log('   If jobs still not showing, check the category matching above\n');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err);
  } finally {
    if (connection) await connection.end();
  }
}

// Haversine distance calculation
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

main();
