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

// فحص Token
function validateToken(token) {
  if (!token) {
    return { valid: false, message: 'Token مفقود' };
  }
  if (token.length < 10) {
    return { valid: false, message: 'Token قصير جداً' };
  }
  if (!token.match(/^[a-zA-Z0-9._-]+$/)) {
    return { valid: false, message: 'Token يحتوي على رموز غير صحيحة' };
  }
  return { valid: true, message: 'Token صحيح' };
}

// إعدادات إنشاء الغرفة مع معالجة شاملة للأخطاء
async function createRoomWithRetry(HBInit, token, maxRetries = 3) {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    attempt++;
    console.log(`🔄 محاولة إنشاء الغرفة رقم ${attempt}/${maxRetries}...`);
    
    try {
      // تحقق من صحة Token أولاً
      if (!token || token.length < 10) {
        throw new Error('Token غير صحيح أو قصير جداً');
      }
      
      // إعدادات الغرفة مع Proxy إذا توفر
      const roomConfig = {
        roomName: 'My Arabic Haxball Room 🇸🇦',
        maxPlayers: 16,
        public: true,
        noPlayer: true,
        token: token,
        debug: process.env.NODE_ENV !== 'production'
      };
      
      // إضافة proxy إذا توفر
      if (process.env.HAXBALL_PROXY) {
        roomConfig.proxy = process.env.HAXBALL_PROXY;
        console.log('🌐 استخدام Proxy:', process.env.HAXBALL_PROXY);
      }
      
      console.log('📋 إعدادات الغرفة:', {
        name: roomConfig.roomName,
        maxPlayers: roomConfig.maxPlayers,
        public: roomConfig.public,
        proxy: roomConfig.proxy ? 'مُفعل' : 'غير مُفعل'
      });
      
      // إنشاء الغرفة
      const room = HBInit(roomConfig);
      
      // تسجيل معالج الأخطاء فوراً لمنع process.exit
      let errorHandled = false;
      const originalError = room.onError;
      
      // Promise لانتظار إنشاء الغرفة أو فشلها
      const roomCreated = new Promise((resolve, reject) => {
        let roomTimeout;
        
        // معالج الأخطاء الفوري
        const handleError = (error, source = 'unknown') => {
          if (errorHandled) return;
          errorHandled = true;
          clearTimeout(roomTimeout);
          console.error(`❌ خطأ في إنشاء الغرفة (${source}):`, error);
          reject(new Error(`Room creation failed (${source}): ${error}`));
        };
        
        // نجح إنشاء الغرفة
        room.onRoomLink = function(link) {
          if (errorHandled) return;
          clearTimeout(roomTimeout);
          console.log('🏈 ========================================');
          console.log('🎉 تم إنشاء الغرفة بنجاح!');
          console.log('🔗 رابط الغرفة:', link);
          console.log('📍 اسم الغرفة: My Arabic Haxball Room 🇸🇦');
          console.log('👥 عدد اللاعبين: 16');
          console.log('🌍 نوع الغرفة: عامة (Public)');
          console.log('🏈 ========================================');
          resolve(room);
        };
        
        // مراقبة أخطاء الغرفة
        room.onRoomError = function(error) {
          handleError(error, 'onRoomError');
        };
        
        // معالج الأخطاء العامة
        room.onError = function(error) {
          handleError(error, 'onError');
        };
        
        // معالج أخطاء العمليات
        if (typeof room.onOperationError !== 'undefined') {
          room.onOperationError = function(error) {
            handleError(error, 'onOperationError');
          };
        }
        
        // مراقبة اللاعبين (بعد التأكد من عدم وجود أخطاء)
        room.onPlayerJoin = function(player) {
          if (!errorHandled) {
            console.log('👤 لاعب جديد انضم:', player.name, `(ID: ${player.id})`);
          }
        };
        
        room.onPlayerLeave = function(player) {
          if (!errorHandled) {
            console.log('👋 لاعب غادر:', player.name, `(ID: ${player.id})`);
          }
        };
        
        // timeout للحماية من التعليق
        roomTimeout = setTimeout(() => {
          handleError('Timeout after 30 seconds', 'timeout');
        }, 30000);
        
        // معالج إضافي للأخطاء غير المتوقعة
        setTimeout(() => {
          if (!errorHandled && !room.onRoomLink) {
            handleError('Room creation failed - no room link received', 'validation');
          }
        }, 1000);
      });
      
      // انتظار نتيجة إنشاء الغرفة
      const createdRoom = await roomCreated;
      console.log('✅ تم إنشاء الغرفة بنجاح بعد', attempt, 'محاولة/محاولات');
      return createdRoom;
      
    } catch (error) {
      console.error(`❌ فشل في المحاولة ${attempt}:`, error.message);
      
      if (attempt === maxRetries) {
        console.error('💥 فشل في إنشاء الغرفة بعد', maxRetries, 'محاولات');
        console.error('🔧 الحلول المقترحة:');
        console.error('   1. تحقق من صحة HAXBALL_TOKEN');
        console.error('   2. تحقق من الاتصال بالإنترنت');
        console.error('   3. جرب استخدام Proxy (HAXBALL_PROXY)');
        console.error('   4. تحقق من logs Render للمزيد من التفاصيل');
        throw error;
      }
      
      // انتظار قبل المحاولة التالية
      const waitTime = attempt * 5000; // 5، 10، 15 ثانية
      console.log(`⏳ انتظار ${waitTime/1000} ثواني قبل المحاولة التالية...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

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
    
    // التحقق من وجود TOKEN وصحته
    const token = process.env.HAXBALL_TOKEN;
    if (!token) {
      console.log('⚠️  HAXBALL_TOKEN environment variable not found');
      console.log('💡 Set HAXBALL_TOKEN in your Render dashboard to create a room');
      console.log('📖 Documentation: https://github.com/haxball/haxball-issues/wiki/Headless-Host');
      console.log('🔗 احصل على Token من: https://www.haxball.com/headlesstoken');
      
      // في بيئة الإنتاج، فشل بسرعة إذا لم يوجد TOKEN
      if (process.env.NODE_ENV === 'production') {
        console.error('💥 التطبيق يحتاج HAXBALL_TOKEN في بيئة الإنتاج');
        throw new Error('HAXBALL_TOKEN required in production');
      }
    } else {
      // التحقق من صحة Token
      const tokenValidation = validateToken(token);
      if (!tokenValidation.valid) {
        console.error('❌ Token غير صحيح:', tokenValidation.message);
        console.error('🔗 احصل على Token صحيح من: https://www.haxball.com/headlesstoken');
        throw new Error(`Invalid token: ${tokenValidation.message}`);
      } else {
        console.log('🔑 Token found, creating Haxball room...');
        await createRoomWithRetry(HBInit, token, 3);
      }
    }
    
    // العثور على port متاح وبدء الخادم
    const availablePort = await findAvailablePort(PORT);
    server.listen(availablePort, '0.0.0.0', () => {
      console.log(`🌐 Server running on port ${availablePort}`);
      console.log(`🏥 Health check: http://localhost:${availablePort}/health`);
    });
    
  } catch (error) {
    console.error('❌ Error starting bot:', error.message);
    console.error('📊 Error details:', error.stack);
    
    // في بيئة الإنتاج فقط، فشل إذا كان خطأ حرج
    if (process.env.NODE_ENV === 'production' && 
        (error.message.includes('HAXBALL_TOKEN required') || 
         error.message.includes('Invalid token'))) {
      console.error('💥 Critical error in production, exiting...');
      process.exit(1);
    } else {
      console.log('🔄 Application will continue running for debugging...');
    }
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
