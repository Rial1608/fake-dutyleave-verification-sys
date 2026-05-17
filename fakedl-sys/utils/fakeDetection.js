const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const documentModel = require('../models/documentModel');
const EventParticipant = require('../models/EventParticipant');

// ════════════════════════════════════════════════════════════════
// FAKE DETECTION ENGINE — MongoDB-integrated
// Uses attendance system data for real-time verification
// ════════════════════════════════════════════════════════════════

const MAX_DISTANCE_KM = parseFloat(process.env.MAX_DISTANCE_KM) || 0.1;

/**
 * Haversine formula — distance between two GPS coordinates in km
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Extract GPS coordinates from EXIF data in a JPEG image
 */
function extractGPSFromImage(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const ExifParser = require('exif-parser');
    const buffer = fs.readFileSync(filePath);
    const parser = ExifParser.create(buffer);
    const result = parser.parse();
    if (result.tags && result.tags.GPSLatitude && result.tags.GPSLongitude) {
      return { lat: result.tags.GPSLatitude, lng: result.tags.GPSLongitude };
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Check UID attendance in the MongoDB 'attendances' collection
 * Uses STRICT event_id matching (primary) with event name fallback
 */
async function checkUIDAttendance(studentId, eventName, eventId) {
  try {
    const uid = (studentId || '').trim().toLowerCase();
    
    console.log("════════════════════════════════════════════════════════════════");
    console.log("🔍 [ATTENDANCE CHECK] Starting UID verification");
    console.log(`   UID: ${uid}`);
    console.log(`   Event ID: ${eventId || '(not provided)'}`);
    console.log(`   Event Name: ${eventName}`);

    const Attendance = mongoose.model('Attendance');

    // Strategy 1: Strict event_id match (preferred)
    if (eventId) {
      console.log(`   📋 Querying MongoDB: Attendance.findOne({ uid: "${uid}", eventId: "${eventId}" })`);
      const record = await Attendance.findOne({
        uid: uid,
        eventId: eventId
      }).lean();

      if (record) {
        console.log(`   ✅ Attendance FOUND (strict eventId match)!`);
        console.log(`      AttendanceID: ${record.attendanceId}`);
        console.log(`      Location: ${record.location?.latitude?.toFixed(4)}, ${record.location?.longitude?.toFixed(4)}`);
        console.log(`      Distance from event: ${record.distance}m`);
        return {
          found: true,
          matchType: 'strict_eventId',
          eventName: eventName,
          record: {
            attendanceId: record.attendanceId,
            uid: record.uid,
            location: record.location,
            eventLocation: record.eventLocation,
            distance: record.distance,
            status: record.status,
            submittedAt: record.submittedAt
          }
        };
      }
      console.log(`   ⚠️  No strict eventId match — trying UID-only fallback...`);
    }

    // Strategy 2: UID-only fallback (most recent record)
    console.log(`   📋 Querying MongoDB (fallback): Attendance.findOne({ uid: "${uid}" }).sort({ submittedAt: -1 })`);
    const fallbackRecord = await Attendance.findOne({ uid: uid }).sort({ submittedAt: -1 }).lean();

    if (fallbackRecord) {
      console.log(`   ✅ Attendance FOUND (UID fallback)!`);
      console.log(`      AttendanceID: ${fallbackRecord.attendanceId}`);
      console.log(`      EventID: ${fallbackRecord.eventId}`);
      console.log(`      Location: ${fallbackRecord.location?.latitude?.toFixed(4)}, ${fallbackRecord.location?.longitude?.toFixed(4)}`);
      console.log(`      Distance from event: ${fallbackRecord.distance}m`);
      return {
        found: true,
        matchType: eventId ? 'uid_fallback' : 'uid_only',
        eventName: eventName,
        record: {
          attendanceId: fallbackRecord.attendanceId,
          uid: fallbackRecord.uid,
          location: fallbackRecord.location,
          eventLocation: fallbackRecord.eventLocation,
          distance: fallbackRecord.distance,
          status: fallbackRecord.status,
          submittedAt: fallbackRecord.submittedAt
        }
      };
    }

    console.log(`   ❌ Attendance NOT FOUND in MongoDB (tried all strategies)`);
    return { found: false, reason: "No matching attendance record for this UID" };
  } catch (e) {
    console.error('❌ [ATTENDANCE CHECK ERROR]', e.message);
    console.error('   Stack:', e.stack);
    return { found: false, error: e.message };
  }
}

/**
 * Run all fake detection checks with numeric scoring
 */
async function runVerification(dlRecord) {
  console.log("\n════════════════════════════════════════════════════════════════");
  console.log("🔐 [VERIFICATION] Starting comprehensive DL verification");
  console.log(`   DL ID: ${dlRecord.dl_id}`);
  console.log(`   Student ID: ${dlRecord.student_id}`);
  console.log(`   Event: ${dlRecord.event_name}`);
  console.log(`   Event ID: ${dlRecord.event_id}`);
  console.log(`   DL Type: ${dlRecord.dl_type}`);
  console.log(`   Event Location: ${dlRecord.event_lat}, ${dlRecord.event_lng}`);
  console.log(`   Photo GPS: ${dlRecord.photo_lat ? dlRecord.photo_lat + ', ' + dlRecord.photo_lng : 'NOT AVAILABLE'}`);
  console.log("════════════════════════════════════════════════════════════════");
  
  const results = [];
  let score = 0;
  const flags = [];

  // CU Campus center for Level 1 check
  const CU_CAMPUS = { lat: 30.7715, lng: 76.5750 };
  const CAMPUS_RADIUS_KM = 0.9;
  const EXACT_BUILDING_RADIUS_KM = 0.2;
  const STRICT_GPS_RADIUS_KM = 0.15;

  // ════════════════════════════════════════════════════════════════
  // PRD BOOLEAN FLAGS — computed alongside existing score checks
  // These follow the PRD verification logic exactly:
  //   Step 1: uidMatch            → attendance.uid === dl.studentId
  //   Step 2: attendanceLocationMatch → distance(att_loc, event_loc) < 100m
  //   Step 3: dlLocationMatch     → distance(photo_loc, event_loc) < 100m
  // ════════════════════════════════════════════════════════════════
  const PRD_THRESHOLD_METERS = 100;
  const prd = {
    uidMatch: false,
    attendanceLocationMatch: false,
    dlLocationMatch: false,
    distance: null // string representing both distances e.g., 'Att: 50m, DL: 10m'
  };

  // ── CHECK 1: GPS Photo Location Verification (Post-DL Only) ──
  const gpsCheck = { name: 'GPS Photo Verification (Post-DL)', passed: true, reason: '' };

  if (dlRecord.dl_type === 'pre') {
    gpsCheck.reason = 'Pre-DL does not require GPS photo verification — skipping check';
  } else {
    console.log(`\n📸 [GPS PHOTO CHECK] Verifying photo GPS metadata...`);
    
    if (dlRecord.gps_photo) {
      const photoPath = dlRecord.gps_photo.startsWith('/')
        ? path.join(__dirname, '..', dlRecord.gps_photo.slice(1))
        : path.resolve(dlRecord.gps_photo);
      
      console.log(`   Photo path: ${photoPath}`);
      
      const gps = extractGPSFromImage(photoPath);
      
      if (gps && dlRecord.event_lat && dlRecord.event_lng) {
        const distance = haversineDistance(gps.lat, gps.lng, dlRecord.event_lat, dlRecord.event_lng);
        const distMeters = Math.round(distance * 1000);
        
        console.log(`   Photo GPS: ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}`);
        console.log(`   Event GPS: ${dlRecord.event_lat.toFixed(4)}, ${dlRecord.event_lng.toFixed(4)}`);
        console.log(`   Distance: ${distMeters}m`);

        if (distance > STRICT_GPS_RADIUS_KM) {
          gpsCheck.passed = false;
          gpsCheck.reason = `⛔ LOCATION MISMATCH: Photo GPS is ${distMeters}m from event location (strict limit: ${STRICT_GPS_RADIUS_KM * 1000}m).`;
          score += 1;
          flags.push(`GPS photo mismatch — ${distMeters}m from event (>${STRICT_GPS_RADIUS_KM * 1000}m)`);
        } else {
          gpsCheck.reason = `✅ Photo GPS verified — ${distMeters}m from event location (within ${STRICT_GPS_RADIUS_KM * 1000}m threshold)`;
        }
      } else if (!gps) {
        gpsCheck.passed = false;
        gpsCheck.reason = '⛔ No GPS metadata found in uploaded photo.';
        score += 1;
        flags.push('GPS EXIF data missing from photo');
      } else {
        gpsCheck.reason = 'Event location coordinates not available — GPS check not possible';
      }
    } else {
      gpsCheck.passed = false;
      gpsCheck.reason = '⛔ No GPS photo uploaded for Post-DL application';
      score += 1;
      flags.push('GPS photo not uploaded');
    }
  }
  results.push(gpsCheck);

  // ── CHECK 1B: Dual-Level Location Verification ──
  const dualLevelCheck = { name: 'Dual-Level Location Check', passed: true, reason: '' };

  if (dlRecord.dl_type === 'pre') {
    dualLevelCheck.reason = 'Pre-DL — location proximity check not applicable';
  } else if (dlRecord.photo_lat && dlRecord.photo_lng && dlRecord.event_lat && dlRecord.event_lng) {
    console.log(`\n📍 [LOCATION CHECK] Verifying dual-level location match...`);
    
    const photoLat = parseFloat(dlRecord.photo_lat);
    const photoLng = parseFloat(dlRecord.photo_lng);
    const eventLat = parseFloat(dlRecord.event_lat);
    const eventLng = parseFloat(dlRecord.event_lng);

    const photoDistFromCampus = haversineDistance(photoLat, photoLng, CU_CAMPUS.lat, CU_CAMPUS.lng);
    const eventDistFromCampus = haversineDistance(eventLat, eventLng, CU_CAMPUS.lat, CU_CAMPUS.lng);
    const photoOnCampus = photoDistFromCampus <= CAMPUS_RADIUS_KM;
    const eventOnCampus = eventDistFromCampus <= CAMPUS_RADIUS_KM;
    const photoZone = photoOnCampus ? 'ON-CAMPUS' : 'OFF-CAMPUS';
    const eventZone = eventOnCampus ? 'ON-CAMPUS' : 'OFF-CAMPUS';
    const buildingDist = haversineDistance(photoLat, photoLng, eventLat, eventLng);
    const buildingDistMeters = Math.round(buildingDist * 1000);

    console.log(`   Photo: ${photoZone} (${photoDistFromCampus.toFixed(3)}km from campus)`);
    console.log(`   Event: ${eventZone} (${eventDistFromCampus.toFixed(3)}km from campus)`);
    console.log(`   Distance between: ${buildingDistMeters}m`);

    // ── PRD Step 3: DL Location Match (photo_location vs event_location < 100m) ──
    prd.distance = prd.distance ? prd.distance + `, Photo: ${buildingDistMeters}m` : `Photo: ${buildingDistMeters}m`;
    prd.dlLocationMatch = buildingDistMeters < PRD_THRESHOLD_METERS;
    
    console.log(`   PRD dlLocationMatch: ${prd.dlLocationMatch} (${buildingDistMeters}m < ${PRD_THRESHOLD_METERS}m)`);

    let levelDetail = '';

    if (photoOnCampus !== eventOnCampus) {
      dualLevelCheck.passed = false;
      levelDetail = `⛔ ZONE MISMATCH: Photo is ${photoZone} but event is ${eventZone}. Distance: ${buildingDistMeters}m.`;
      score += 1;
      flags.push(`Zone mismatch: Photo ${photoZone} / Event ${eventZone}`);
    } else if (photoOnCampus && eventOnCampus) {
      if (buildingDist > EXACT_BUILDING_RADIUS_KM) {
        dualLevelCheck.passed = false;
        levelDetail = `⛔ BUILDING MISMATCH (In-Campus): ${buildingDistMeters}m apart (limit: ${EXACT_BUILDING_RADIUS_KM * 1000}m).`;
        score += 1;
        flags.push(`In-campus building mismatch — ${buildingDistMeters}m apart`);
      } else {
        levelDetail = `✅ SAME BUILDING: ${buildingDistMeters}m apart (within ${EXACT_BUILDING_RADIUS_KM * 1000}m threshold).`;
      }
    } else {
      if (buildingDist > EXACT_BUILDING_RADIUS_KM) {
        dualLevelCheck.passed = false;
        levelDetail = `⛔ LOCATION MISMATCH (Off-Campus): ${buildingDistMeters}m apart (limit: ${EXACT_BUILDING_RADIUS_KM * 1000}m).`;
        score += 1;
        flags.push(`Off-campus location mismatch — ${buildingDistMeters}m apart`);
      } else {
        levelDetail = `✅ SAME VENUE: ${buildingDistMeters}m apart (within ${EXACT_BUILDING_RADIUS_KM * 1000}m threshold).`;
      }
    }
    dualLevelCheck.reason = `Level 1 — Photo: ${photoZone} / Event: ${eventZone} | Level 2 — ${levelDetail}`;
  } else {
    dualLevelCheck.reason = 'Photo GPS or event coordinates unavailable — dual-level check skipped';
  }
  results.push(dualLevelCheck);

  // ── CHECK 2: UID Attendance Verification (MongoDB) ──
  const attendanceCheck = { name: 'UID Attendance Verification', passed: true, reason: '', details: {} };
  const uidResult = await checkUIDAttendance(dlRecord.student_id, dlRecord.event_name, dlRecord.event_id);

  if (uidResult.found) {
    // ── PRD Step 1: UID Match ──
    if (uidResult.record && uidResult.record.uid) {
      prd.uidMatch = (uidResult.record.uid.toLowerCase() === dlRecord.student_id.toLowerCase());
    } else {
      // Found via EventParticipants (no attendance record with uid)
      // UID was used to search, so it's a match by definition
      prd.uidMatch = true;
    }

    console.log(`\n👤 [UID MATCH] PRD uidMatch: ${prd.uidMatch}`);

    attendanceCheck.reason = `Student UID ${dlRecord.student_id} found in attendance records (${uidResult.matchType}: "${uidResult.eventName}")`;
    attendanceCheck.details = { found: true, matchType: uidResult.matchType };

    // ── CHECK 2B: Attendance GPS vs DL Event Location ──
    if (uidResult.record && uidResult.record.location && dlRecord.event_lat && dlRecord.event_lng) {
      console.log(`\n📍 [ATTENDANCE LOCATION] Verifying attendance location match...`);
      
      const attLat = uidResult.record.location.latitude;
      const attLng = uidResult.record.location.longitude;
      const dist = haversineDistance(attLat, attLng, dlRecord.event_lat, dlRecord.event_lng);
      const distMeters = Math.round(dist * 1000);

      console.log(`   Attendance GPS: ${attLat.toFixed(4)}, ${attLng.toFixed(4)}`);
      console.log(`   Event GPS: ${dlRecord.event_lat.toFixed(4)}, ${dlRecord.event_lng.toFixed(4)}`);
      console.log(`   Distance: ${distMeters}m`);

      attendanceCheck.details.distanceMeters = distMeters;
      attendanceCheck.details.attendanceLat = attLat;
      attendanceCheck.details.attendanceLng = attLng;

      // ── PRD Step 2: Attendance Location Match (att_location vs event_location < 100m) ──
      prd.distance = prd.distance ? `Att: ${distMeters}m, ` + prd.distance : `Att: ${distMeters}m`;
      prd.attendanceLocationMatch = distMeters < PRD_THRESHOLD_METERS;
      
      console.log(`   PRD attendanceLocationMatch: ${prd.attendanceLocationMatch} (${distMeters}m < ${PRD_THRESHOLD_METERS}m)`);

      if (dist > MAX_DISTANCE_KM) {
        attendanceCheck.details.locationMatch = false;
        attendanceCheck.reason += ` | ⚠️ Attendance GPS is ${distMeters}m from event (threshold: ${MAX_DISTANCE_KM * 1000}m)`;
        // Don't fail the check, but add a flag
        flags.push(`Attendance location ${distMeters}m from event`);
      } else {
        attendanceCheck.details.locationMatch = true;
        attendanceCheck.reason += ` | ✅ Attendance GPS ${distMeters}m from event (within ${MAX_DISTANCE_KM * 1000}m)`;
      }
    }
  } else {
    attendanceCheck.passed = false;
    attendanceCheck.reason = `Student UID ${dlRecord.student_id} NOT found in attendance records for "${dlRecord.event_name}"`;
    attendanceCheck.details = { found: false };
    score += 1;
    flags.push('Attendance UID not found');
    console.log(`\n❌ [UID MATCH] Attendance NOT found - PRD uidMatch: false`);
    // PRD: uidMatch stays false
  }
  results.push(attendanceCheck);

  // ── CHECK 3: Coordinator Approval for Pre-DL ──
  const coordinatorCheck = { name: 'ACO/HOD Approval (Pre-DL)', passed: true, reason: '' };
  if (dlRecord.dl_type === 'pre') {
    console.log(`\n✉️  [COORDINATOR] Checking ACO/HOD approval for Pre-DL...`);
    
    if (!dlRecord.coordinator_approval) {
      coordinatorCheck.passed = false;
      coordinatorCheck.reason = 'ACO/HOD approval is required for Pre-DL but not provided';
      score += 1;
      flags.push('Missing ACO/HOD approval');
      console.log(`   ❌ No approval found`);
    } else {
      coordinatorCheck.reason = 'ACO/HOD approval received';
      console.log(`   ✅ Approval found`);
    }
  } else {
    coordinatorCheck.reason = 'Not required for Post-DL';
    console.log(`\n✉️  [COORDINATOR] Not required for Post-DL`);
  }
  results.push(coordinatorCheck);

  // ── CHECK 4: Date Verification ──
  console.log(`\n📅 [DATE CHECK] Verifying event date...`);
  const dateCheck = { name: 'Event Date Validation', passed: true, reason: '' };
  if (dlRecord.event_date && dlRecord.submitted_at) {
    const eventDate = new Date(dlRecord.event_date);
    const submitDate = new Date(dlRecord.submitted_at);

    console.log(`   Event Date: ${dlRecord.event_date}`);
    console.log(`   Submitted: ${submitDate.toISOString().split('T')[0]}`);
    console.log(`   Type: ${dlRecord.dl_type}`);

    if (dlRecord.dl_type === 'pre') {
      if (submitDate > eventDate) {
        dateCheck.passed = false;
        dateCheck.reason = `Pre-DL submitted after event date (Event: ${dlRecord.event_date}, Submitted: ${submitDate.toISOString().split('T')[0]})`;
        score += 1;
        flags.push('Event date mismatch');
        console.log(`   ❌ Pre-DL submitted AFTER event (invalid)`);
      } else {
        dateCheck.reason = 'Pre-DL submitted before event date — valid';
        console.log(`   ✅ Pre-DL submitted BEFORE event (valid)`);
      }
    } else {
      if (submitDate < eventDate) {
        dateCheck.passed = false;
        dateCheck.reason = `Post-DL submitted before event date`;
        score += 1;
        flags.push('Event date mismatch');
        console.log(`   ❌ Post-DL submitted BEFORE event (invalid)`);
      } else {
        const daysDiff = Math.floor((submitDate - eventDate) / (1000 * 60 * 60 * 24));
        if (daysDiff > 7) {
          dateCheck.passed = false;
          dateCheck.reason = `Post-DL submitted ${daysDiff} days after event (max: 7 days)`;
          score += 1;
          flags.push('Event date mismatch');
          console.log(`   ❌ Post-DL submitted ${daysDiff} days AFTER event (max 7 days)`);
        } else {
          dateCheck.reason = `Post-DL submitted ${daysDiff} day(s) after event — within threshold`;
          console.log(`   ✅ Post-DL submitted ${daysDiff} day(s) after event (within threshold)`);
        }
      }
    }
  } else {
    dateCheck.passed = false;
    dateCheck.reason = 'Event date or submission date missing';
    score += 1;
    flags.push('Event date mismatch');
    console.log(`   ❌ Missing event date or submission date`);
  }
  results.push(dateCheck);

  // ── CHECK 5: Duplicate Document Detection (SHA-256) ──
  console.log(`\n🔄 [DUPLICATE CHECK] Checking for duplicate documents...`);
  const dupCheck = { name: 'Duplicate Document Detection', passed: true, reason: '' };
  const hashesToCheck = [dlRecord.gps_photo_hash, dlRecord.supporting_doc_hash].filter(Boolean);
  
  if (hashesToCheck.length > 0) {
    console.log(`   Checking ${hashesToCheck.length} document hash(es)...`);
    
    let dupFound = false;
    let dupDetails = [];
    for (const hash of hashesToCheck) {
      const dupes = await documentModel.findByHash(hash);
      const otherDupes = dupes.filter(d => d.dl_id !== dlRecord.dl_id);
      if (otherDupes.length > 0) {
        dupFound = true;
        dupDetails.push(`hash matched ${otherDupes.length} other DL(s): ${otherDupes.map(d => 'DL-' + d.dl_id).join(', ')}`);
      }
    }
    if (dupFound) {
      dupCheck.passed = false;
      dupCheck.reason = `Duplicate document(s) detected — ${dupDetails.join('; ')}`;
      score += 1;
      flags.push('Duplicate document detected');
      console.log(`   ❌ Duplicate(s) found: ${dupDetails.join('; ')}`);
    } else {
      dupCheck.reason = 'No duplicate documents found across all submissions';
      console.log(`   ✅ No duplicates found`);
    }
  } else {
    dupCheck.reason = 'No document hashes available for comparison';
    console.log(`   ⚠️  No document hashes available`);
  }
  results.push(dupCheck);

  // ════════════════════════════════════════════════════════════════
  // SCORE SUMMARY (no auto-decision — admin decides)
  // ════════════════════════════════════════════════════════════════
  const summary = score === 0
    ? `All ${results.length} checks passed`
    : `${score} of ${results.length} checks failed`;

  console.log(`\n════════════════════════════════════════════════════════════════`);
  console.log(`📊 [VERIFICATION RESULT]`);
  console.log(`   Score: ${score}/${results.length}`);
  console.log(`   Summary: ${summary}`);
  console.log(`   UID Match: ${prd.uidMatch}`);
  console.log(`   Attendance Location Match: ${prd.attendanceLocationMatch}`);
  console.log(`   DL Location Match: ${prd.dlLocationMatch}`);
  console.log(`   Distance: ${prd.distance}`);
  console.log(`════════════════════════════════════════════════════════════════\n`);

  return {
    // Verification data
    results,
    score,
    flags,
    summary,
    failedChecks: score,
    totalChecks: results.length,
    // PRD boolean flags (data only — no auto status)
    prd: {
      uidMatch: prd.uidMatch,
      attendanceLocationMatch: prd.attendanceLocationMatch,
      dlLocationMatch: prd.dlLocationMatch,
      distance: prd.distance
    }
  };
}

module.exports = { runVerification, haversineDistance, extractGPSFromImage, checkUIDAttendance };

