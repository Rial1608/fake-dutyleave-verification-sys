const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');

// ════════════════════════════════════════════════════════════════
// ATTENDANCE ROUTES - /api/attendance base route
// ════════════════════════════════════════════════════════════════

// Submit attendance
router.post('/', attendanceController.submitAttendance); // POST /api/attendance
router.post('/submit', attendanceController.submitAttendance); // Alias

// Get attendance by event
router.get('/event/:eventId', attendanceController.getAttendanceByEvent);

// Get attendance by UID and event
router.get('/:uid/:eventId', attendanceController.getAttendanceByUidEvent);

// Verify attendance (manual)
router.patch('/verify/:attendanceId', attendanceController.verifyAttendance);

// Export attendance data
router.get('/export/:eventId', attendanceController.exportAttendance);

module.exports = router;
