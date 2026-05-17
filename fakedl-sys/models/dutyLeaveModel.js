const DutyLeave = require('./DutyLeave');
const DLDocument = require('./Document');
const { getNextDlId } = require('./Counter');
const fs = require('fs');
const path = require('path');

// ════════════════════════════════════════════════════════════════
// DUTY LEAVE MODEL — Mongoose adapter
// All methods are async (Mongoose-based)
// ════════════════════════════════════════════════════════════════

const USERS_FILE = path.join(__dirname, '..', 'database', 'users.json');

function loadUsers() {
  const data = fs.readFileSync(USERS_FILE, 'utf-8');
  return JSON.parse(data).users;
}

function getUserByUid(uid) {
  const users = loadUsers();
  const normalizedUid = (uid || '').trim().toLowerCase();
  const u = users.find(u => u.uid.toLowerCase() === normalizedUid);
  if (!u) return { name: uid, department: 'Unknown', email: '' };
  return { name: u.name, department: u.department, email: u.email || '' };
}

const dutyLeaveModel = {
  async create(data) {
    const dlId = await getNextDlId();
    const doc = await DutyLeave.create({
      dlId,
      studentId: data.student_id,
      dlType: data.dl_type,
      campusType: data.campus_type,
      eventName: data.event_name,
      eventLocation: data.event_location,
      eventDate: data.event_date,
      eventLat: data.event_lat || null,
      eventLng: data.event_lng || null,
      eventId: data.event_id || null,
      coordinatorApproval: data.coordinator_approval || 0,
      attendanceVerification: data.attendanceVerification || {},
      submittedAt: new Date()
    });
    console.log(`💾 [DL] Saved duty leave DL-${dlId} to MongoDB`);
    return dlId;
  },

  async findByStudentId(studentId) {
    const normalizedId = (studentId || '').trim();
    const dls = await DutyLeave.find({ studentId: new RegExp('^' + normalizedId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }).sort({ submittedAt: -1 }).lean();
    // Join with documents
    const results = [];
    for (const dl of dls) {
      const doc = await DLDocument.findOne({ dlId: dl.dlId }).lean();
      results.push({
        dl_id: dl.dlId,
        student_id: dl.studentId,
        dl_type: dl.dlType,
        campus_type: dl.campusType,
        event_name: dl.eventName,
        event_location: dl.eventLocation,
        event_date: dl.eventDate,
        event_lat: dl.eventLat,
        event_lng: dl.eventLng,
        event_id: dl.eventId,
        coordinator_approval: dl.coordinatorApproval,
        status: dl.status,
        flag_reasons: dl.flagReasons,
        submitted_at: dl.submittedAt,
        attendance_verification: dl.attendanceVerification,
        gps_photo: doc ? doc.gpsPhoto : null,
        supporting_doc: doc ? doc.supportingDoc : null
      });
    }
    return results;
  },

  async findAll() {
    const dls = await DutyLeave.find().sort({ submittedAt: -1 }).lean();
    const results = [];
    for (const dl of dls) {
      const doc = await DLDocument.findOne({ dlId: dl.dlId }).lean();
      const user = getUserByUid(dl.studentId);
      results.push({
        dl_id: dl.dlId,
        student_id: dl.studentId,
        student_name: user.name,
        department: user.department,
        dl_type: dl.dlType,
        campus_type: dl.campusType,
        event_name: dl.eventName,
        event_location: dl.eventLocation,
        event_date: dl.eventDate,
        event_lat: dl.eventLat,
        event_lng: dl.eventLng,
        event_id: dl.eventId,
        coordinator_approval: dl.coordinatorApproval,
        status: dl.status,
        flag_reasons: dl.flagReasons,
        submitted_at: dl.submittedAt,
        attendance_verification: dl.attendanceVerification,
        gps_photo: doc ? doc.gpsPhoto : null,
        supporting_doc: doc ? doc.supportingDoc : null
      });
    }
    return results;
  },

  async findById(dlId) {
    const dl = await DutyLeave.findOne({ dlId }).lean();
    if (!dl) return null;

    const doc = await DLDocument.findOne({ dlId }).lean();
    const user = getUserByUid(dl.studentId);

    return {
      dl_id: dl.dlId,
      student_id: dl.studentId,
      student_name: user.name,
      department: user.department,
      email: user.email,
      dl_type: dl.dlType,
      campus_type: dl.campusType,
      event_name: dl.eventName,
      event_location: dl.eventLocation,
      event_date: dl.eventDate,
      event_lat: dl.eventLat,
      event_lng: dl.eventLng,
      event_id: dl.eventId,
      coordinator_approval: dl.coordinatorApproval,
      status: dl.status,
      flag_reasons: dl.flagReasons,
      submitted_at: dl.submittedAt,
      attendance_verification: dl.attendanceVerification,
      // Document fields
      doc_id: doc ? doc._id : null,
      gps_photo: doc ? doc.gpsPhoto : null,
      supporting_doc: doc ? doc.supportingDoc : null,
      gps_photo_hash: doc ? doc.gpsPhotoHash : null,
      supporting_doc_hash: doc ? doc.supportingDocHash : null,
      photo_lat: doc ? doc.photoLat : null,
      photo_lng: doc ? doc.photoLng : null
    };
  },

  async updateStatus(dlId, status, flagReasons = null) {
    return await DutyLeave.updateOne(
      { dlId },
      { status, flagReasons: flagReasons ? JSON.stringify(flagReasons) : null }
    );
  },

  async getStats(studentId) {
    const normalizedId = (studentId || '').trim();
    const pipeline = [
      { $match: { studentId: new RegExp('^' + normalizedId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } },
      { $group: { _id: '$status', cnt: { $sum: 1 } } }
    ];
    const results = await DutyLeave.aggregate(pipeline);
    const stats = { total: 0, pending: 0, approved: 0, rejected: 0, flagged: 0 };
    results.forEach(row => {
      stats[row._id] = row.cnt;
      stats.total += row.cnt;
    });
    return stats;
  },

  async getAdminStats() {
    const pipeline = [
      { $group: { _id: '$status', cnt: { $sum: 1 } } }
    ];
    const results = await DutyLeave.aggregate(pipeline);
    const stats = { total: 0, pending: 0, approved: 0, rejected: 0, flagged: 0 };
    results.forEach(row => {
      stats[row._id] = row.cnt;
      stats.total += row.cnt;
    });
    return stats;
  }
};

module.exports = dutyLeaveModel;
