const mongoose = require('mongoose');

// ════════════════════════════════════════════════════════════════
// ENV VALIDATION — fail loudly if MONGODB_URI is missing
// ════════════════════════════════════════════════════════════════
const RAW_URI = process.env.MONGODB_URI;

if (!RAW_URI || RAW_URI.trim() === '') {
  console.error('═══════════════════════════════════════════');
  console.error('❌ MONGODB_URI is NOT set in .env!');
  console.error('   Cannot connect to MongoDB Atlas.');
  console.error('   Add MONGODB_URI to your .env file.');
  console.error('═══════════════════════════════════════════');
}

// Log loaded URI (credentials masked) for debugging
const maskUri = (uri) => uri ? uri.replace(/\/\/[^@]+@/, '//***:***@') : '(undefined)';
console.log(`ℹ️  Loaded MONGODB_URI: ${maskUri(RAW_URI)}`);

// Inject database name if missing from Atlas URI
const ensureDbName = (uri) => {
  if (!uri) return uri;
  if (uri.includes('mongodb+srv://') || uri.includes('mongodb://')) {
    const urlParts = uri.split('?');
    const basePart = urlParts[0];
    const queryPart = urlParts[1] || '';

    const hostMatch = basePart.match(/mongodb(\+srv)?:\/\/[^/]+\/(.*)$/);
    if (hostMatch) {
      const dbName = hostMatch[2].trim();
      if (!dbName || dbName === '') {
        const fixedBase = basePart.endsWith('/') ? basePart + 'attendance_system' : basePart + '/attendance_system';
        const fixedUri = queryPart ? `${fixedBase}?${queryPart}` : fixedBase;
        console.log('ℹ️  No database name in URI — using "attendance_system"');
        return fixedUri;
      }
    }
  }
  return uri;
};

const MONGODB_URI = ensureDbName(RAW_URI);

// In-memory storage for demo mode (fallback ONLY for network issues)
const demoMode = {
  enabled: false,
  forms: {},
  attendance: {}
};

const connectDB = async () => {
  try {
    // ── Pre-flight check ──────────────────────────────────────
    if (!MONGODB_URI || MONGODB_URI.trim() === '') {
      throw new Error('MONGODB_URI is undefined or empty. Check your .env file.');
    }

    if (mongoose.connection.readyState === 1) {
      console.log('✅ MongoDB already connected');
      return;
    }

    console.log('🌐 Connecting to MongoDB...');
    console.log(`   URI: ${maskUri(MONGODB_URI)}`);

    // Mongoose 8+ does not need useNewUrlParser/useUnifiedTopology
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      w: 'majority',
    });

    const dbName = mongoose.connection.db.databaseName;
    console.log('✅ MongoDB Connected Successfully');
    console.log(`   Database: ${dbName}`);
    console.log(`   Host: ${mongoose.connection.host}`);
    console.log(`   ReadyState: ${mongoose.connection.readyState}`);
    demoMode.enabled = false;

    // Listen for disconnection events
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
      demoMode.enabled = false;
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });

  } catch (error) {
    console.error('═══════════════════════════════════════════');
    console.error('❌ MongoDB Connection FAILED');
    console.error(`   Error: ${error.message}`);

    // ── Distinguish auth errors from network errors ────────────
    const isAuthError = error.message.includes('bad auth') ||
                        error.message.includes('authentication failed') ||
                        error.message.includes('AuthenticationFailed') ||
                        (error.code === 8000);

    if (isAuthError) {
      console.error('');
      console.error('   🔑 THIS IS AN AUTHENTICATION ERROR.');
      console.error('   ► Check your username & password in .env');
      console.error('   ► If password contains special chars (@ # % /),');
      console.error('     URL-encode them (e.g. @ → %40, # → %23)');
      console.error('   ► Verify user exists in Atlas → Database Access');
      console.error('   ► Ensure user has "Read and Write to Any Database" role');
      console.error('═══════════════════════════════════════════');
      // Auth errors should NOT silently fall back — re-throw
      throw error;
    }

    // Network/timeout errors — fall back to demo mode
    console.error('   🌐 This appears to be a network/timeout issue.');
    console.error('   ► Check your IP is whitelisted in Atlas → Network Access');
    console.error('   ► Verify internet connectivity');
    console.error('═══════════════════════════════════════════');
    console.log('🚀 Falling back to DEMO MODE (in-memory storage)');
    console.log('   ⚠️  Data will NOT persist after server restart');
    console.log('   ⚠️  Data will NOT appear in MongoDB Atlas');
    demoMode.enabled = true;

    // Disconnect Mongoose to prevent buffer timeouts
    try {
      await mongoose.disconnect();
    } catch (e) {
      // ignore disconnect errors
    }
  }
};

const disconnectDB = async () => {
  try {
    if (demoMode.enabled) {
      console.log('✅ Demo mode data cleared');
      return;
    }
    await mongoose.disconnect();
    console.log('✅ MongoDB Disconnected');
  } catch (error) {
    console.error('❌ MongoDB Disconnection Error:', error.message);
  }
};

module.exports = { connectDB, disconnectDB, demoMode };
