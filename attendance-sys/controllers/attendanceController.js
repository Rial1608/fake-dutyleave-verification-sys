const Attendance = require('../models/attendanceModel');
const Form = require('../models/formModel');
const { demoMode } = require('../database/connection');

// ════════════════════════════════════════════════════════════════
// ATTENDANCE CONTROLLER
// ════════════════════════════════════════════════════════════════

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
};

// Helper to safely convert responses to plain object
const responsesToObject = (responses) => {
  if (!responses) return {};
  if (typeof responses === 'object' && !responses.entries) return responses;
  try {
    if (responses instanceof Map) return Object.fromEntries(responses);
    if (typeof responses === 'string') return JSON.parse(responses);
    return responses;
  } catch {
    return responses;
  }
};

// Submit Attendance
exports.submitAttendance = async (req, res) => {
  try {
    // Log incoming request body for debugging
    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('📥 [ATTENDANCE SUBMIT] Received request:');
    console.log('   Storage mode:', demoMode.enabled ? '⚠️  DEMO (in-memory)' : '✅ MONGODB');

    const { formId, uid: rawUid, responses, location } = req.body;

    // Normalize UID to lowercase for case-insensitive matching
    const uid = (rawUid || '').trim().toLowerCase();

    console.log(`   UID (normalized): ${uid}`);
    console.log(`   FormID: ${formId}`);
    console.log(`   Location: ${location?.latitude?.toFixed(4)}, ${location?.longitude?.toFixed(4)}`);

    // Validate input
    if (!formId || !uid || !location) {
      return res.status(400).json({ error: 'Missing required fields: formId, uid, location' });
    }

    if (!location.latitude || !location.longitude) {
      return res.status(400).json({ error: 'GPS location (latitude/longitude) is required' });
    }

    // Get form details (from demo mode or database)
    let form;
    if (demoMode.enabled) {
      form = demoMode.forms[formId];
    } else {
      form = await Form.findOne({ formId });
    }

    if (!form) {
      console.log(`   ❌ Form not found: ${formId}`);
      return res.status(404).json({ error: 'Form not found' });
    }

    console.log(`   ✅ Form found: ${form.eventName}`);
    console.log(`      EventID: ${form.eventId}`);

    if (!form.isActive) {
      return res.status(400).json({ error: 'Form is no longer active' });
    }

    // Check for duplicate submission (one UID per event) — uses normalized uid
    const uniqueKey = `${uid}_${formId}_${form.eventId}`;
    
    let existingSubmission = null;
    if (demoMode.enabled) {
      existingSubmission = Object.values(demoMode.attendance || {}).find(a => a.uniqueKey === uniqueKey);
    } else {
      existingSubmission = await Attendance.findOne({ uniqueKey });
    }

    if (existingSubmission) {
      console.log(`   ❌ Duplicate submission detected for UID:${uid} EventID:${form.eventId}`);
      return res.status(400).json({ error: 'You have already submitted attendance for this event' });
    }

    // Validate required fields
    if (responses && form.fields) {
      for (const field of form.fields) {
        if (field.required && (!responses[field.id] || String(responses[field.id]).trim() === '')) {
          return res.status(400).json({ error: `Field "${field.label}" is required` });
        }
      }
    }

    // Calculate distance from event location
    const distance = calculateDistance(
      location.latitude, location.longitude,
      form.eventLocation.latitude, form.eventLocation.longitude
    );

    // Determine status based on distance
    const isWithinRange = distance <= (form.maxLocationDistance || 100);
    const status = isWithinRange ? 'VALID' : 'FLAGGED';

    console.log(`   📍 Distance from event: ${Math.round(distance)}m`);
    console.log(`   Status: ${status} ${isWithinRange ? '✅' : '⚠️'}`);

    // Create attendance record
    const attendanceId = `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const submittedAt = new Date();
    
    const attendanceData = {
      attendanceId,
      formId,
      eventId: form.eventId,
      uid,
      responses: responses || {},
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy
      },
      eventLocation: {
        latitude: form.eventLocation.latitude,
        longitude: form.eventLocation.longitude
      },
      distance: Math.round(distance),
      status,
      submittedAt,
      verificationDetails: {
        isWithinRange,
        verifiedBy: 'gps_auto',
        verifiedAt: submittedAt
      },
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
      uniqueKey
    };

    if (demoMode.enabled) {
      // Use in-memory demo storage — DATA WILL NOT PERSIST
      console.log('   ⚠️  DEMO MODE: Saving to IN-MEMORY storage');
      console.log('   ⚠️  This data will NOT appear in MongoDB Atlas!');
      demoMode.attendance[attendanceId] = attendanceData;
      return res.status(201).json({
        message: 'Attendance recorded (DEMO MODE — not saved to MongoDB)',
        storage: 'memory',
        attendance: {
          attendanceId,
          status,
          distance: Math.round(distance),
          isWithinRange,
          submittedAt
        }
      });
    }

    console.log(`   💾 Saving to MongoDB...`);
    console.log(`      Collection: attendance`);
    console.log(`      Data: { uid: "${uid}", eventId: "${form.eventId}", status: "${status}" }`);
    
    const attendance = new Attendance(attendanceData);
    const savedDoc = await attendance.save();
    
    console.log(`   ✅ SAVED to MongoDB successfully!`);
    console.log(`      AttendanceID: ${savedDoc.attendanceId}`);
    console.log(`      UID: ${savedDoc.uid}`);
    console.log(`      EventID: ${savedDoc.eventId}`);
    console.log(`      Status: ${savedDoc.status}`);
    console.log(`      Distance: ${savedDoc.distance}m`);
    console.log('════════════════════════════════════════════════════════════════\n');

    return res.status(201).json({
      message: 'Attendance recorded successfully',
      storage: 'mongodb',
      attendance: {
        attendanceId,
        status,
        distance: Math.round(distance),
        isWithinRange,
        submittedAt
      }
    });
  } catch (error) {
    console.error('❌ Attendance submission error:', error);
    console.log('════════════════════════════════════════════════════════════════\n');
    return res.status(500).json({ error: 'Failed to submit attendance', details: error.message });
  }
};

// Get Attendance by Event
exports.getAttendanceByEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    let attendance;
    if (demoMode.enabled) {
      attendance = Object.values(demoMode.attendance || {}).filter(a => a.eventId === eventId);
    } else {
      attendance = await Attendance.find({ eventId }).sort({ submittedAt: -1 });
    }

    const stats = {
      totalSubmissions: attendance.length,
      validEntries: attendance.filter(a => a.status === 'VALID').length,
      flaggedEntries: attendance.filter(a => a.status === 'FLAGGED').length,
      averageDistance: attendance.length > 0 
        ? Math.round(attendance.reduce((sum, a) => sum + (a.distance || 0), 0) / attendance.length)
        : 0
    };

    return res.status(200).json({
      stats,
      attendance: attendance.map(a => ({
        attendanceId: a.attendanceId,
        uid: a.uid,
        responses: responsesToObject(a.responses),
        distance: a.distance,
        status: a.status,
        submittedAt: a.submittedAt
      }))
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    return res.status(500).json({ error: 'Failed to fetch attendance' });
  }
};

// Get Attendance by UID and Event
exports.getAttendanceByUidEvent = async (req, res) => {
  try {
    const { uid, eventId } = req.params;

    let attendance;
    if (demoMode.enabled) {
      attendance = Object.values(demoMode.attendance || {}).find(a => a.uid === uid && a.eventId === eventId);
    } else {
      attendance = await Attendance.findOne({ uid, eventId });
    }

    if (!attendance) {
      return res.status(404).json({ error: 'No attendance record found' });
    }

    return res.status(200).json({
      attendance: {
        attendanceId: attendance.attendanceId,
        uid: attendance.uid,
        responses: responsesToObject(attendance.responses),
        location: attendance.location,
        distance: attendance.distance,
        status: attendance.status,
        submittedAt: attendance.submittedAt
      }
    });
  } catch (error) {
    console.error('Get attendance by UID error:', error);
    return res.status(500).json({ error: 'Failed to fetch attendance' });
  }
};

// Verify Attendance (Manual verification by admin)
exports.verifyAttendance = async (req, res) => {
  try {
    const { attendanceId } = req.params;
    const { status, verifiedBy } = req.body;

    if (!['VALID', 'FLAGGED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    if (demoMode.enabled) {
      const att = demoMode.attendance[attendanceId];
      if (!att) {
        return res.status(404).json({ error: 'Attendance record not found' });
      }
      att.status = status;
      att.verificationDetails = {
        ...att.verificationDetails,
        verifiedBy: verifiedBy || 'manual_admin',
        verifiedAt: new Date()
      };
      return res.status(200).json({
        message: 'Attendance verified',
        attendance: {
          attendanceId: att.attendanceId,
          status: att.status,
          verifiedAt: att.verificationDetails.verifiedAt
        }
      });
    }

    const attendance = await Attendance.findOneAndUpdate(
      { attendanceId },
      {
        status,
        'verificationDetails.verifiedBy': verifiedBy || 'manual_admin',
        'verificationDetails.verifiedAt': new Date()
      },
      { new: true }
    );

    if (!attendance) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    return res.status(200).json({
      message: 'Attendance verified',
      attendance: {
        attendanceId: attendance.attendanceId,
        status: attendance.status,
        verifiedAt: attendance.verificationDetails.verifiedAt
      }
    });
  } catch (error) {
    console.error('Attendance verification error:', error);
    return res.status(500).json({ error: 'Failed to verify attendance' });
  }
};

// Export Attendance Data
exports.exportAttendance = async (req, res) => {
  try {
    const { eventId } = req.params;

    let attendance;
    if (demoMode.enabled) {
      attendance = Object.values(demoMode.attendance || {}).filter(a => a.eventId === eventId);
    } else {
      attendance = await Attendance.find({ eventId }).sort({ submittedAt: -1 });
    }

    // Convert to CSV format
    const csvHeader = ['UID', 'Status', 'Distance (m)', 'Latitude', 'Longitude', 'Submitted At'];
    const csvRows = attendance.map(a => [
      a.uid,
      a.status,
      a.distance,
      a.location.latitude,
      a.location.longitude,
      new Date(a.submittedAt).toISOString()
    ]);

    const csv = [csvHeader, ...csvRows].map(row => row.join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_${eventId}_${Date.now()}.csv"`);
    return res.send(csv);
  } catch (error) {
    console.error('Export attendance error:', error);
    return res.status(500).json({ error: 'Failed to export attendance' });
  }
};
