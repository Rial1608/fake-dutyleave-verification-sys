const { connectDB } = require('./mongoConnection');
const mongoose = require('mongoose');

const setupDatabase = async () => {
  // Connect to MongoDB Atlas
  await connectDB();

  // Import and register all Mongoose models
  const DutyLeave = require('../models/DutyLeave');
  const DLDocument = require('../models/Document');
  const EventParticipant = require('../models/EventParticipant');
  const { Counter } = require('../models/Counter');

  // Register attendance-sys models so we can cross-query them
  // These schemas match what attendance-sys creates
  if (!mongoose.models.Attendance) {
    const AttendanceSchema = new mongoose.Schema({
      attendanceId: { type: String, unique: true, index: true },
      formId: { type: String, index: true },
      eventId: { type: String, index: true },
      uid: { type: String, index: true },
      responses: { type: mongoose.Schema.Types.Mixed },
      location: {
        latitude: Number,
        longitude: Number,
        accuracy: Number
      },
      eventLocation: {
        latitude: Number,
        longitude: Number
      },
      distance: Number,
      status: { type: String, enum: ['VALID', 'FLAGGED', 'REJECTED'] },
      verificationDetails: {
        isWithinRange: Boolean,
        verifiedBy: String,
        verifiedAt: Date
      },
      uniqueKey: { type: String, unique: true, sparse: true },
      submittedAt: { type: Date, index: true }
    }, { timestamps: false, collection: 'attendances' });
    AttendanceSchema.index({ uid: 1, eventId: 1 });
    mongoose.model('Attendance', AttendanceSchema);
  }

  if (!mongoose.models.Form) {
    const FormSchema = new mongoose.Schema({
      formId: { type: String, unique: true },
      eventId: { type: String },
      eventName: { type: String },
      eventLocation: {
        latitude: Number,
        longitude: Number,
        address: String
      },
      eventDateTime: Date,
      fields: [mongoose.Schema.Types.Mixed],
      description: String,
      organizerId: String,
      organizerName: String,
      qrCode: String,
      isActive: Boolean,
      maxLocationDistance: Number,
      createdAt: Date
    }, { timestamps: false, collection: 'forms' });
    mongoose.model('Form', FormSchema);
  }

  // Sync indexes for DL-specific collections
  console.log('📦 Syncing DL system collections & indexes...');
  await DutyLeave.syncIndexes();
  await DLDocument.syncIndexes();
  await EventParticipant.syncIndexes();

  // Seed EventParticipants if empty (backward compatibility)
  const epCount = await EventParticipant.countDocuments();
  if (epCount === 0) {
    const seedData = [
      { eventName: 'National Hackathon 2026', studentId: '25BCS13539', studentName: 'Ritik Sharma', participationDate: '2026-03-05' },
      { eventName: 'National Hackathon 2026', studentId: '25BCS13541', studentName: 'Khushi Raheja', participationDate: '2026-03-05' },
      { eventName: 'Tech Summit 2026', studentId: '25BCS13539', studentName: 'Ritik Sharma', participationDate: '2026-04-15' },
      { eventName: 'Tech Summit 2026', studentId: '25BCS10413', studentName: 'Ayan Ranjan', participationDate: '2026-04-15' },
      { eventName: 'CU Sports Meet 2026', studentId: '25BCS13541', studentName: 'Khushi Raheja', participationDate: '2026-03-20' },
      { eventName: 'CU Sports Meet 2026', studentId: '25BCS13569', studentName: 'Charchil Vijayvergiya', participationDate: '2026-03-20' },
      { eventName: 'AI Workshop 2026', studentId: '25BCS13539', studentName: 'Ritik Sharma', participationDate: '2026-05-10' },
      { eventName: 'Code Sprint 2026', studentId: '25BCS11382', studentName: 'Shishant Kumar', participationDate: '2026-03-25' },
      { eventName: 'Code Sprint 2026', studentId: '25BCS13539', studentName: 'Ritik Sharma', participationDate: '2026-03-25' }
    ];
    await EventParticipant.insertMany(seedData);
    console.log('✓ Event participants seed data inserted into MongoDB');
  }

  // List all collections in the database
  const collections = await mongoose.connection.db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);
  console.log(`   Collections found: ${collectionNames.join(', ')}`);
  console.log('✅ DL Database setup complete (MongoDB mode)');
};

module.exports = setupDatabase;
