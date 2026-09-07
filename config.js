/**
 * Environment-based Configuration
 * Manages all environment-specific settings for WebRTC calling
 */

const env = process.env.NODE_ENV || 'development';

const config = {
  development: {
    environment: 'development',
    baseUrl: 'http://localhost:3000',
    signalingUrl: 'http://localhost:3000',
    wsUrl: 'ws://localhost:3000',
    // TURN config will be fetched from database
  },
  
  staging: {
    environment: 'staging',
    baseUrl: 'https://staging.joinlinko.com',
    signalingUrl: 'https://staging.joinlinko.com',
    wsUrl: 'wss://staging.joinlinko.com',
  },
  
  production: {
    environment: 'production',
    baseUrl: 'https://joinlinko.com',
    signalingUrl: 'https://joinlinko.com',
    wsUrl: 'wss://joinlinko.com',
  }
};

module.exports = config[env];
