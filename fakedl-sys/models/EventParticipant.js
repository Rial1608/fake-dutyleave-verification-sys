const mongoose = require('mongoose');

// ════════════════════════════════════════════════════════════════
// EVENT PARTICIPANT SCHEMA — stored in 'eventparticipants' collection
// Backward-compatible seed data for local event lookup
// ════════════════════════════════════════════════════════════════

const eventParticipantSchema = new mongoose.Schema({
  eventName: {
    type: String,
    required: true,
    index: true
  },
  studentId: {
    type: String,
    required: true,
    index: true
  },
  studentName: {
    type: String,
    default: null
  },
  participationDate: {
    type: String,
    default: null
  }
}, {
  timestamps: false,
  collection: 'eventparticipants'
});

// Unique constraint: one student per event
eventParticipantSchema.index({ eventName: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('EventParticipant', eventParticipantSchema);
