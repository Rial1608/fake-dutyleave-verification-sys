const mongoose = require('mongoose');

// ════════════════════════════════════════════════════════════════
// MONGODB ATLAS CONNECTION
// Shared database: attendance_system
// ════════════════════════════════════════════════════════════════

const RAW_URI = process.env.MONGODB_URI;

const maskUri = (uri) => uri ? uri.replace(/\/\/[^@]+@/, '//***:***@') : '(undefined)';

if (!RAW_URI || RAW_URI.trim() === '') {
  console.error('═══════════════════════════════════════════');
  console.error('❌ MONGODB_URI is NOT set in .env!');
  console.error('   The Fake DL system REQUIRES MongoDB Atlas.');
  console.error('   Add MONGODB_URI to your .env file.');
  console.error('═══════════════════════════════════════════');
}

// Ensure database name is present
const ensureDbName = (uri) => {
  if (!uri) return uri;
  const urlParts = uri.split('?');
  const basePart = urlParts[0];
  const queryPart = urlParts[1] || '';
  const hostMatch = basePart.match(/mongodb(\+srv)?:\/\/[^/]+\/(.*)$/);
  if (hostMatch) {
    const dbName = hostMatch[2].trim();
    if (!dbName) {
      const fixedBase = basePart.endsWith('/') ? basePart + 'attendance_system' : basePart + '/attendance_system';
      console.log('ℹ️  No database name in URI — using "attendance_system"');
      return queryPart ? `${fixedBase}?${queryPart}` : fixedBase;
    }
  }
  return uri;
};

const MONGODB_URI = ensureDbName(RAW_URI);

const connectDB = async () => {
  if (!MONGODB_URI || MONGODB_URI.trim() === '') {
    throw new Error('MONGODB_URI is undefined or empty. Check your .env file.');
  }

  if (mongoose.connection.readyState === 1) {
    console.log('✅ MongoDB already connected');
    return;
  }

  console.log('🌐 Connecting to MongoDB Atlas...');
  console.log(`   URI: ${maskUri(MONGODB_URI)}`);

  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });

  const dbName = mongoose.connection.db.databaseName;
  console.log('✅ MongoDB Connected Successfully');
  console.log(`   Database: ${dbName}`);
  console.log(`   Connection State: ${mongoose.connection.readyState} (1=connected)`);
  console.log(`   Host: ${mongoose.connection.host}`);
  console.log(`   Port: ${mongoose.connection.port}`);
  console.log(`   Host: ${mongoose.connection.host}`);

  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected');
  });
};

const disconnectDB = async () => {
  await mongoose.disconnect();
  console.log('✅ MongoDB Disconnected');
};

module.exports = { connectDB, disconnectDB };
