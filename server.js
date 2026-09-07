/**
 * Custom Server with Auto-Migration + WebRTC Signaling
 * 
 * This file runs migrations automatically when the server starts.
 * Perfect for Hostinger auto-deploy - no manual commands needed!
 * Now includes WebSocket signaling for WebRTC calling.
 */

const { createServer } = require('http');
const { parse } = require('url');
const { spawn } = require('child_process');
const next = require('next');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0'; // Listen on all network interfaces (allows LAN access)
const port = parseInt(process.env.PORT || '3000', 10);

// Load environment variables
const envFile = dev ? '.env.local' : '.env.production';
require('dotenv').config({ path: path.resolve(process.cwd(), envFile) });

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Database configuration
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};
const DB_NAME = process.env.DB_NAME || 'linko';

/**
 * Ensure required directories exist
 */
function ensureDirectories() {
  const directories = [
    'public/uploads/customers',
    'public/uploads/partners',
    'public/uploads/documents',
    'public/uploads/categories',
  ];

  console.log('📁 Checking required directories...');
  
  directories.forEach((dir) => {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`✅ Created: ${dir}`);
    }
  });
  
  console.log('✅ All directories ready\n');
}

/**
 * Run all migrations using the auto-migrate system
 */
async function runMigrations() {
  try {
    console.log('🔄 Running database migrations via auto-migrate system...\n');
    
    return new Promise((resolve) => {
      const autoMigrate = spawn('node', [path.join(__dirname, 'scripts', 'auto_migrate.js')], {
        env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' },
        cwd: process.cwd()
      });

      autoMigrate.stdout.on('data', (data) => {
        process.stdout.write(data.toString());
      });

      autoMigrate.stderr.on('data', (data) => {
        process.stderr.write(data.toString());
      });

      autoMigrate.on('close', (code) => {
        if (code === 0) {
          console.log('\n✅ Auto-migration completed successfully\n');
        } else {
          console.log('\n⚠️  Auto-migration had issues but continuing...\n');
        }
        resolve();
      });

      autoMigrate.on('error', (error) => {
        console.error('⚠️  Migration error:', error.message);
        console.log('⚠️  Server will start anyway...\n');
        resolve();
      });
    });
    
  } catch (error) {
    console.error('⚠️  Migration error:', error.message);
    console.log('⚠️  Server will start anyway...\n');
  }
}

/**
 * Start the server
 */
async function startServer() {
  try {
    // Ensure directories exist
    ensureDirectories();
    
    // Run migrations first
    await runMigrations();
    
    // Prepare Next.js
    await app.prepare();
    
    // Create HTTP server
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error handling request:', err);
        res.statusCode = 500;
        res.end('Internal server error');
      }
    });

    // Initialize Socket.IO for WebRTC signaling
    const io = new Server(server, {
      cors: {
        origin: '*', // In production, specify your domains
        methods: ['GET', 'POST']
      },
      path: '/socket.io/'
    });

    // Store active users and their socket connections
    const activeUsers = new Map(); // Map<userId, { socketId, userType, phone }>
    const activeCalls = new Map(); // Map<callId, { caller, receiver, status }>

    io.on('connection', (socket) => {
      console.log('✅ WebSocket connected:', socket.id);

      // User registration
      socket.on('register', (data) => {
        const { userId, userType, phone } = data;
        activeUsers.set(userId, {
          socketId: socket.id,
          userType,
          phone
        });
        socket.userId = userId;
        socket.userType = userType;
        socket.phone = phone;
        console.log(`📝 Registered: ${userType} ${userId} (${phone})`);
      });

      // Call initiation
      socket.on('call:offer', async (data) => {
        const { to, from, offer, callType } = data;
        const receiver = activeUsers.get(to);
        
        if (receiver) {
          io.to(receiver.socketId).emit('call:offer', {
            from,
            offer,
            callType,
            callerPhone: socket.phone
          });
          console.log(`📞 Call offer: ${from} → ${to}`);
        } else {
          socket.emit('call:error', { message: 'User not available' });
        }
      });

      // Call answer
      socket.on('call:answer', (data) => {
        const { to, from, answer } = data;
        const caller = activeUsers.get(to);
        
        if (caller) {
          io.to(caller.socketId).emit('call:answer', {
            from,
            answer
          });
          console.log(`✅ Call answered: ${from} → ${to}`);
        }
      });

      // ICE candidate exchange
      socket.on('ice:candidate', (data) => {
        const { to, candidate } = data;
        const user = activeUsers.get(to);
        
        if (user) {
          io.to(user.socketId).emit('ice:candidate', {
            from: socket.userId,
            candidate
          });
        }
      });

      // Call rejection
      socket.on('call:reject', (data) => {
        const { to } = data;
        const caller = activeUsers.get(to);
        
        if (caller) {
          io.to(caller.socketId).emit('call:rejected', {
            from: socket.userId
          });
          console.log(`❌ Call rejected: ${socket.userId} → ${to}`);
        }
      });

      // Call end
      socket.on('call:end', (data) => {
        const { to } = data;
        const user = activeUsers.get(to);
        
        if (user) {
          io.to(user.socketId).emit('call:ended', {
            from: socket.userId
          });
          console.log(`📴 Call ended: ${socket.userId} → ${to}`);
        }
      });

      // Disconnect
      socket.on('disconnect', () => {
        if (socket.userId) {
          activeUsers.delete(socket.userId);
          console.log(`❌ Disconnected: ${socket.userType} ${socket.userId}`);
        }
      });
    });

    server.listen(port, (err) => {
      if (err) throw err;
      console.log(`🚀 Server ready on http://${hostname}:${port}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔌 WebSocket signaling enabled`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start everything
startServer();
