const HaxballJS = require('./src/index.js');
const http = require('http');

// إنشاء خادم HTTP بسيط للـ health check
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'OK', 
      service: 'Haxball.JS Bot',
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Haxball.JS Bot is running!\n');
});

const PORT = process.env.PORT || 3000;

// التحقق من وجود port متاح
function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const testServer = require('http').createServer();
    testServer.listen(startPort, (err) => {
      if (err) {
        console.log(`Port ${startPort} busy, trying ${startPort + 1}`);
        testServer.close();
        if (startPort < 3010) {
          findAvailablePort(startPort + 1).then(resolve).catch(reject);
        } else {
          reject(new Error('No available ports found'));
        }
      } else {
        testServer.close();
        resolve(startPort);
      }
    });
  });
}

async function startBot() {
  try {
    console.log('🚀 Starting Haxball.JS Bot...');
    
    // تهيئة مكتبة Haxball
    const HBInit = await HaxballJS();
    console.log('✅ Haxball.JS library loaded successfully');
    
    // التحقق من وجود TOKEN
    const token = process.env.HAXBALL_TOKEN;
    if (!token) {
      console.log('⚠️  HAXBALL_TOKEN environment variable not found');
      console.log('💡 Set HAXBALL_TOKEN in your Render dashboard to create a room');
      console.log('📖 Documentation: https://github.com/haxball/haxball-issues/wiki/Headless-Host');
    } else {
      console.log('🔑 Token found, you can create rooms');
      
      // مثال على إنشاء غرفة (اختياري)
      // يمكن للمستخدم تفعيل هذا الجزء عند الحاجة
      /*
      const room = HBInit({
        roomName: 'My Haxball Room',
        maxPlayers: 16,
        public: false,
        noPlayer: true,
        token: token
      });
      
      room.onRoomLink = function(link) {
        console.log('🔗 Room created:', link);
      };
      */
    }
    
    // العثور على port متاح وبدء الخادم
    const availablePort = await findAvailablePort(PORT);
    server.listen(availablePort, '0.0.0.0', () => {
      console.log(`🌐 Server running on port ${availablePort}`);
      console.log(`🏥 Health check: http://localhost:${availablePort}/health`);
    });
    
  } catch (error) {
    console.error('❌ Error starting bot:', error.message);
    process.exit(1);
  }
}

// إشارات إيقاف التطبيق
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

// بدء التطبيق
startBot();