#!/usr/bin/env node

// Test script for Service Coverage Engine API endpoints
// Run: node scripts/test_service_areas_api.js

const BASE_URL = 'http://localhost:3000';

async function testPublicAvailabilityCheck() {
  console.log('\n🧪 TEST 1: Public Availability Check (Inside Coverage)');
  console.log('=' .repeat(60));
  
  try {
    const response = await fetch(`${BASE_URL}/api/service-availability/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: 22.2735,  // Mavdi, Rajkot (inside coverage)
        longitude: 70.7513
      })
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log(data.available ? '✅ PASS: Location is available' : '❌ FAIL: Should be available');
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

async function testOutsideCoverage() {
  console.log('\n🧪 TEST 2: Public Availability Check (Outside Coverage)');
  console.log('=' .repeat(60));
  
  try {
    const response = await fetch(`${BASE_URL}/api/service-availability/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: 28.7041,  // Delhi (outside coverage)
        longitude: 77.1025
      })
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log(!data.available ? '✅ PASS: Location is not available' : '❌ FAIL: Should not be available');
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

async function testInvalidCoordinates() {
  console.log('\n🧪 TEST 3: Invalid Coordinates (Should return 400)');
  console.log('=' .repeat(60));
  
  try {
    const response = await fetch(`${BASE_URL}/api/service-availability/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: 999,  // Invalid
        longitude: 70.7513
      })
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log(response.status === 400 ? '✅ PASS: Returns 400 for invalid input' : '❌ FAIL: Should return 400');
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

async function testRateLimit() {
  console.log('\n🧪 TEST 4: Rate Limiting (31 rapid requests)');
  console.log('=' .repeat(60));
  
  try {
    let rateLimited = false;
    
    for (let i = 0; i < 31; i++) {
      const response = await fetch(`${BASE_URL}/api/service-availability/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: 22.2735, longitude: 70.7513 })
      });

      if (response.status === 429) {
        rateLimited = true;
        const data = await response.json();
        console.log(`Request ${i + 1}: Rate limited ✅`);
        console.log('Response:', JSON.stringify(data, null, 2));
        break;
      }
    }

    console.log(rateLimited ? '✅ PASS: Rate limiting works' : '⚠️  WARNING: Rate limit not triggered');
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

async function testHaversineAccuracy() {
  console.log('\n🧪 TEST 5: Haversine Distance Calculation');
  console.log('=' .repeat(60));
  
  try {
    // Test point 4.5 km away (should be inside 5km radius)
    const response1 = await fetch(`${BASE_URL}/api/service-availability/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: 22.3135,  // ~4.5 km north
        longitude: 70.7513
      })
    });

    const data1 = await response1.json();
    console.log('4.5 km away:', data1.available ? '✅ Inside coverage' : '❌ Should be inside');
    if (data1.available) {
      console.log('Distance:', data1.area.distanceMeters, 'meters');
    }

    // Test point 6 km away (should be outside 5km radius)
    const response2 = await fetch(`${BASE_URL}/api/service-availability/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: 22.3335,  // ~6.5 km north
        longitude: 70.7513
      })
    });

    const data2 = await response2.json();
    console.log('6.5 km away:', !data2.available ? '✅ Outside coverage' : '❌ Should be outside');
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

async function runTests() {
  console.log('\n🚀 SERVICE COVERAGE ENGINE - API TESTS');
  console.log('=' .repeat(60));
  console.log('Base URL:', BASE_URL);
  console.log('Make sure the dev server is running: npm run dev\n');

  await testPublicAvailabilityCheck();
  await testOutsideCoverage();
  await testInvalidCoordinates();
  await testHaversineAccuracy();
  await testRateLimit();

  console.log('\n' + '=' .repeat(60));
  console.log('✅ All tests completed!\n');
}

runTests();
