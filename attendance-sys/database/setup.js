const { connectDB, demoMode } = require('./connection');

const setupDatabase = async () => {
  try {
    await connectDB();

    if (!demoMode.enabled) {
      // Import models to register schemas and auto-create collections
      const Form = require('../models/formModel');
      const Attendance = require('../models/attendanceModel');

      // Sync indexes — this also creates the collections if they don't exist
      console.log('📦 Syncing database collections & indexes...');
      await Form.syncIndexes();
      await Attendance.syncIndexes();

      // Verify collections exist
      const collections = await require('mongoose').connection.db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      console.log(`   Collections found: ${collectionNames.join(', ')}`);
      console.log('✅ Database setup complete (MongoDB mode)');
    } else {
      console.log('✅ Database setup complete (DEMO mode — data is in-memory only)');
    }
  } catch (error) {
    console.error('❌ Database setup error:', error.message);
    // Don't exit — allow demo mode to work
    if (!demoMode.enabled) {
      console.log('⚠️  Falling back to DEMO mode');
      demoMode.enabled = true;
    }
  }
};

module.exports = setupDatabase;
