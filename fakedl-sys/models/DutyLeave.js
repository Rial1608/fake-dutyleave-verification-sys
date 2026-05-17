const mongoose = require('mongoose');

// ════════════════════════════════════════════════════════════════
// DUTY LEAVE SCHEMA — stored in 'dutyleaves' collection
// Shared database: attendance_system
// ════════════════════════════════════════════════════════════════

const dutyLeaveSchema = new mongoose.Schema({
  dlId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  studentId: {
    type: String,
    required: true,
    index: true
  },
  dlType: {
    type: String,
    required: true,
    enum: ['pre', 'post']
  },
  campusType: {
    type: String,
    required: true,
    enum: ['in-campus', 'out-campus']
  },
  eventName: {
    type: String,
    required: true
  },
  eventLocation: {
    type: String,
    required: true
  },
  eventDate: {
    type: String,
    required: true
  },
  eventLat: {
    type: Number,
    default: null
  },
  eventLng: {
    type: Number,
    default: null
  },
  eventId: {
    type: String,
    default: null,
    index: true
  },
  coordinatorApproval: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    default: 'pending',
    enum: ['pending', 'approved', 'rejected', 'flagged'],
    index: true
  },
  flagReasons: {
    type: String,
    default: null
  },
  // Attendance verification results (stored at submission time)
  attendanceVerification: {
    found: { type: Boolean, default: false },
    attendanceId: { type: String, default: null },
    attendanceUid: { type: String, default: null },
    attendanceLat: { type: Number, default: null },
    attendanceLng: { type: Number, default: null },
    distanceMeters: { type: Number, default: null },
    locationMatch: { type: Boolean, default: false }
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false,
  collection: 'dutyleaves'
});

// Compound index for preventing duplicate DL per student+event
dutyLeaveSchema.index({ studentId: 1, eventId: 1 });

module.exports = mongoose.model('DutyLeave', dutyLeaveSchema);
