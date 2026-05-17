const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
    attendanceId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    formId: {
        type: String,
        required: true,
        index: true,
    },
    eventId: {
        type: String,
        required: true,
        index: true,
    },
    uid: {
        type: String,
        required: true,
        index: true,
    },
    responses: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },
    location: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
        accuracy: { type: Number, default: null }
    },
    eventLocation: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true }
    },
    distance: {
        type: Number,
        default: null,
    },
    status: {
        type: String,
        enum: ['VALID', 'FLAGGED', 'REJECTED'],
        default: 'VALID',
        index: true,
    },
    verificationDetails: {
        isWithinRange: { type: Boolean, default: false },
        verifiedBy: { type: String, default: 'auto' },
        verifiedAt: { type: Date, default: Date.now }
    },
    userAgent: {
        type: String,
        default: null,
    },
    ipAddress: {
        type: String,
        default: null,
    },
    uniqueKey: {
        type: String,
        unique: true,
        sparse: true
    },
    submittedAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: false
});

// Compound index for querying attendance by UID and event
AttendanceSchema.index({ uid: 1, eventId: 1 });

module.exports = mongoose.model('Attendance', AttendanceSchema);
