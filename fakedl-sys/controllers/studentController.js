const dutyLeaveModel = require('../models/dutyLeaveModel');
const documentModel = require('../models/documentModel');
const studentModel = require('../models/studentModel');
const { computeHash } = require('../utils/fileHash');
const { extractGPSFromImage, haversineDistance, checkUIDAttendance } = require('../utils/fakeDetection');
const path = require('path');

// CU Campus center coordinates and radius
const CU_CAMPUS = { lat: 30.7715, lng: 76.5750, radiusKm: 0.9 };
const MAX_DISTANCE_KM = parseFloat(process.env.MAX_DISTANCE_KM) || 0.1;

const studentController = {
  async getDashboard(req, res) {
    try {
      console.log("🔷 [API HIT] GET /api/dl/student/dashboard");
      
      const user = req.session.user;
      console.log("   User session:", user ? `${user.name} (${user.student_id})` : "NO SESSION");
      
      if (!user) {
        console.log("   ❌ Auth check failed - returning 401");
        return res.status(401).json({ error: 'Not authenticated' });
      }

      console.log(`   ✅ Auth passed, fetching dashboard for student: ${user.student_id}`);
      const student = studentModel.findById(user.student_id);
      const stats = await dutyLeaveModel.getStats(user.student_id);
      const recent = (await dutyLeaveModel.findByStudentId(user.student_id)).slice(0, 5);

      console.log(`   📊 Dashboard stats:`, stats);
      res.json({ success: true, student, stats, recentDLs: recent });
    } catch (error) {
      console.error('❌ [API ERROR] Dashboard error:', error.message);
      console.error('   Stack:', error);
      res.status(500).json({ error: 'Failed to load dashboard', details: error.message });
    }
  },

  async applyDL(req, res) {
    try {
      const user = req.session.user;
      if (!user) return res.status(401).json({ error: 'Not authenticated' });

      const { event_name: rawEventName, event_location, event_date, event_lat, event_lng, event_id, coordinator_approval } = req.body;

      // Normalize event name to lowercase for case-insensitive matching
      const event_name = (rawEventName || '').trim().toLowerCase();

      if (!event_name || !event_location || !event_date) {
        return res.status(400).json({ error: 'Event name, location, and date are required' });
      }

      // --- AUTO-DETECT DL TYPE ---
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const eventDateObj = new Date(event_date);
      eventDateObj.setHours(0, 0, 0, 0);
      const dl_type = eventDateObj > today ? 'pre' : 'post';

      // --- AUTO-DETECT CAMPUS TYPE ---
      let campus_type = 'out-campus';
      const lat = parseFloat(event_lat);
      const lng = parseFloat(event_lng);

      if (!isNaN(lat) && !isNaN(lng)) {
        const distFromCampus = haversineDistance(lat, lng, CU_CAMPUS.lat, CU_CAMPUS.lng);
        campus_type = distFromCampus <= CU_CAMPUS.radiusKm ? 'in-campus' : 'out-campus';
      } else if (event_location.toLowerCase().includes('chandigarh university') || event_location.toLowerCase().includes(' cu')) {
        campus_type = 'in-campus';
      }

      const coordApproval = dl_type === 'pre' && (coordinator_approval === 'true' || coordinator_approval === '1') ? 1 : 0;

      // Normalize student_id to lowercase for case-insensitive matching
      const normalizedStudentId = (user.student_id || '').trim().toLowerCase();

      // --- REAL-TIME ATTENDANCE VERIFICATION ---
      console.log(`\n📋 [DL APPLY] UID:${normalizedStudentId} Event:"${event_name}" EventID:${event_id || 'none'}`);
      let attendanceVerification = { found: false };

      const uidResult = await checkUIDAttendance(normalizedStudentId, event_name, event_id || null);
      if (uidResult.found && uidResult.record && uidResult.record.location) {
        const attLat = uidResult.record.location.latitude;
        const attLng = uidResult.record.location.longitude;
        let distMeters = null;
        let locationMatch = false;

        if (!isNaN(lat) && !isNaN(lng)) {
          const dist = haversineDistance(attLat, attLng, lat, lng);
          distMeters = Math.round(dist * 1000);
          locationMatch = dist <= MAX_DISTANCE_KM;
        }

        attendanceVerification = {
          found: true,
          attendanceId: uidResult.record.attendanceId,
          attendanceUid: uidResult.record.uid,
          attendanceLat: attLat,
          attendanceLng: attLng,
          distanceMeters: distMeters,
          locationMatch: locationMatch
        };

        console.log(`   ✅ Attendance found. Distance: ${distMeters}m, Match: ${locationMatch}`);
      } else if (uidResult.found) {
        attendanceVerification = { found: true };
        console.log(`   ✅ Attendance found (no GPS data available)`);
      } else {
        console.log(`   ❌ Attendance NOT found`);
      }

      // Create duty leave record
      const dlId = await dutyLeaveModel.create({
        student_id: normalizedStudentId,
        dl_type,
        campus_type,
        event_name,
        event_location,
        event_date,
        event_lat: !isNaN(lat) ? lat : null,
        event_lng: !isNaN(lng) ? lng : null,
        event_id: event_id || null,
        coordinator_approval: coordApproval,
        attendanceVerification
      });

      // Handle file uploads
      const files = req.files || {};
      const gpsPhotoFile = files.gps_photo ? files.gps_photo[0] : null;
      const supportingDocFile = files.supporting_doc ? files.supporting_doc[0] : null;

      let photoLat = null, photoLng = null;
      let gpsPhotoHash = null, supportingDocHash = null;

      if (gpsPhotoFile) {
        gpsPhotoHash = computeHash(gpsPhotoFile.path);
        const gps = extractGPSFromImage(gpsPhotoFile.path);
        if (gps) {
          photoLat = gps.lat;
          photoLng = gps.lng;
        }
      }
      if (supportingDocFile) {
        supportingDocHash = computeHash(supportingDocFile.path);
      }

      const gpsPhotoRelPath = gpsPhotoFile ? '/uploads/' + gpsPhotoFile.filename : null;
      const supportingDocRelPath = supportingDocFile ? '/uploads/' + supportingDocFile.filename : null;

      // Store document with extracted GPS metadata
      console.log(`\n📸 [DL DOCUMENTS] Storing for DL-${dlId}:`);
      console.log(`   GPS Photo: ${gpsPhotoRelPath}`);
      console.log(`   Photo GPS: ${photoLat ? `${photoLat}, ${photoLng}` : 'NOT EXTRACTED'}`);
      console.log(`   Supporting Doc: ${supportingDocRelPath}`);

      await documentModel.create({
        dlId: dlId,
        gpsPhoto: gpsPhotoRelPath,
        supportingDoc: supportingDocRelPath,
        gpsPhotoHash: gpsPhotoHash,
        supportingDocHash: supportingDocHash,
        photoLat: photoLat,
        photoLng: photoLng
      });

      console.log(`   ✅ Documents saved to MongoDB`);

      // All DLs start as 'pending' — admin decides final status
      res.json({
        success: true,
        dl_id: dlId,
        dl_type,
        campus_type,
        attendanceVerification,
        message: 'Duty Leave application submitted successfully',
        photoGps: photoLat ? { lat: photoLat, lng: photoLng } : null
      });
    } catch (error) {
      console.error('DL Apply error:', error);
      res.status(500).json({ error: 'Failed to submit DL application', details: error.message });
    }
  },

  async getDLStatus(req, res) {
    try {
      console.log("🔷 [API HIT] GET /api/dl/student/dl-status");
      
      const user = req.session.user;
      console.log("   User session:", user ? `${user.name} (${user.student_id})` : "NO SESSION");
      
      if (!user) {
        console.log("   ❌ Auth check failed - returning 401");
        return res.status(401).json({ error: 'Not authenticated' });
      }

      console.log(`   ✅ Auth passed, fetching DLs for student: ${user.student_id}`);
      const dls = await dutyLeaveModel.findByStudentId(user.student_id);
      
      console.log(`   📊 Found ${dls.length} DL records for this student`);
      res.json({ success: true, dls });
    } catch (error) {
      console.error('❌ [API ERROR] DL Status error:', error.message);
      console.error('   Stack:', error);
      res.status(500).json({ error: 'Failed to load DL status', details: error.message });
    }
  },

  async geocode(req, res) {
    const query = req.query.q;
    if (!query || query.trim().length < 3) {
      return res.status(400).json({ error: 'Query must be at least 3 characters' });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      return res.json({
        success: false,
        error: 'Google Maps API key not configured.'
      });
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        res.json({
          success: true,
          lat: location.lat,
          lng: location.lng,
          display_name: data.results[0].formatted_address
        });
      } else if (data.status === 'REQUEST_DENIED') {
        res.json({ success: false, error: 'Google Maps API key is invalid.' });
      } else {
        res.json({ success: false, error: data.error_message || 'Location not found.' });
      }
    } catch (err) {
      console.error('Geocoding error:', err.message);
      res.json({ success: false, error: 'Geocoding service unavailable.' });
    }
  }
};

module.exports = studentController;
