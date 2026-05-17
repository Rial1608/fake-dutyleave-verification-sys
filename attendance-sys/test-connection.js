/**
 * Quick MongoDB Atlas connection test.
 * Run:  node test-connection.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;
console.log('Testing connection with URI:', uri ? uri.replace(/\/\/[^@]+@/, '//***:***@') : '(undefined)');

if (!uri) {
  console.error('❌ MONGODB_URI is not set in .env');
  process.exit(1);
}

mongoose.connect(uri, {
  serverSelectionTimeoutMS: 10000,
})
  .then(() => {
    console.log('✅ Connected successfully!');
    console.log('   Database:', mongoose.connection.db.databaseName);
    console.log('   Host:', mongoose.connection.host);
    return mongoose.disconnect();
  })
  .then(() => {
    console.log('✅ Disconnected. Test passed!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  });
