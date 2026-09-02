/**
 * Test Wallet API - Verify minimum withdrawal amount is returned
 */

const https = require('https');

async function testWalletAPI() {
  console.log('🧪 Testing Wallet API...\n');

  // You'll need to replace this with a valid partner auth token
  const AUTH_TOKEN = 'YOUR_PARTNER_AUTH_TOKEN_HERE';

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/partner/wallet',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('📥 Response Status:', res.statusCode);
          console.log('📦 Response Data:', JSON.stringify(response, null, 2));

          if (response.settings && response.settings.minimum_withdrawal_amount) {
            console.log('\n✅ SUCCESS: minimum_withdrawal_amount is present');
            console.log(`💰 Value: ₹${response.settings.minimum_withdrawal_amount}`);
          } else {
            console.log('\n❌ FAILED: minimum_withdrawal_amount is missing from settings');
          }

          resolve(response);
        } catch (error) {
          console.error('❌ Error parsing response:', error);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request error:', error);
      reject(error);
    });

    req.end();
  });
}

// Run test
testWalletAPI()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
