/* ════════════════════════════════════════════════════════════════
   ATTENDANCE SYSTEM - DL INTEGRATION MODULE
   Provides attendance data for Fake DL system verification
   ════════════════════════════════════════════════════════════════ */

const axios = require('axios');
const Attendance = require('../models/attendanceModel');

class AttendanceIntegration {
    /**
     * Fetch attendance record by UID and event
     * Used by Fake DL system to verify student attendance
     */
    static async getAttendanceByUidEvent(uid, eventId) {
        try {
            const attendance = await Attendance.findOne({
                uid,
                event_id: eventId
            });

            if (!attendance) {
                return {
                    found: false,
                    message: 'No attendance record found'
                };
            }

            return {
                found: true,
                uid: attendance.uid,
                eventId: attendance.event_id,
                formId: attendance.form_id,
                timestamp: attendance.timestamp,
                location: {
                    latitude: attendance.latitude,
                    longitude: attendance.longitude,
                    distance: attendance.distance_from_event
                },
                status: attendance.status,
                responses: attendance.responses,
                verificationNotes: attendance.verification_notes
            };
        } catch (error) {
            console.error('Attendance lookup error:', error);
            return {
                found: false,
                error: error.message
            };
        }
    }

    /**
     * Fetch all attendance records for an event
     */
    static async getEventAttendance(eventId, filters = {}) {
        try {
            const query = { event_id: eventId };

            // Apply filters
            if (filters.status) {
                query.status = filters.status;
            }

            if (filters.dateFrom || filters.dateTo) {
                query.timestamp = {};
                if (filters.dateFrom) {
                    query.timestamp.$gte = new Date(filters.dateFrom);
                }
                if (filters.dateTo) {
                    query.timestamp.$lte = new Date(filters.dateTo);
                }
            }

            const attendance = await Attendance.find(query)
                .sort({ timestamp: -1 })
                .lean();

            const stats = {
                totalSubmissions: attendance.length,
                validEntries: attendance.filter(a => a.status === 'VALID').length,
                flaggedEntries: attendance.filter(a => a.status === 'FLAGGED').length,
                rejectedEntries: attendance.filter(a => a.status === 'REJECTED').length,
                averageDistance: attendance.length > 0
                    ? Math.round(
                        attendance.reduce((sum, a) => sum + (a.distance_from_event || 0), 0) / attendance.length
                    )
                    : 0
            };

            return {
                success: true,
                stats,
                records: attendance.map(record => ({
                    uid: record.uid,
                    timestamp: record.timestamp,
                    location: {
                        latitude: record.latitude,
                        longitude: record.longitude,
                        distance: record.distance_from_event
                    },
                    status: record.status,
                    responses: record.responses
                }))
            };
        } catch (error) {
            console.error('Event attendance fetch error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Verify attendance authenticity
     */
    static async verifyAttendanceAuthenticity(attendanceId) {
        try {
            const attendance = await Attendance.findById(attendanceId);

            if (!attendance) {
                return {
                    verified: false,
                    reason: 'Attendance record not found'
                };
            }

            const checks = {
                locationValidated: attendance.status === 'VALID',
                timestampValid: attendance.timestamp && new Date(attendance.timestamp) <= new Date(),
                requiredFieldsPresent: Object.keys(attendance.responses).length > 0,
                uniqueSubmission: true // Enforced at DB level via index
            };

            const allChecksPass = Object.values(checks).every(v => v === true);

            return {
                verified: allChecksPass,
                attendanceId: attendance._id,
                uid: attendance.uid,
                checks,
                confidence: allChecksPass ? 'HIGH' : 'MEDIUM',
                details: {
                    submittedAt: attendance.timestamp,
                    status: attendance.status,
                    distance: attendance.distance_from_event,
                    verifiedBy: attendance.verification_notes
                }
            };
        } catch (error) {
            console.error('Attendance verification error:', error);
            return {
                verified: false,
                error: error.message
            };
        }
    }

    /**
     * Flag suspicious attendance
     */
    static async flagAttendance(attendanceId, reason) {
        try {
            const attendance = await Attendance.findByIdAndUpdate(
                attendanceId,
                {
                    status: 'FLAGGED',
                    verification_notes: reason
                },
                { new: true }
            );

            return {
                success: true,
                message: 'Attendance flagged for review',
                attendance: attendance
            };
        } catch (error) {
            console.error('Flag attendance error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate attendance report for event
     */
    static async generateEventReport(eventId) {
        try {
            const attendance = await Attendance.find({ event_id: eventId }).lean();

            if (attendance.length === 0) {
                return {
                    success: false,
                    message: 'No attendance records found for this event'
                };
            }

            const report = {
                eventId,
                generatedAt: new Date(),
                totalSubmissions: attendance.length,
                summary: {
                    valid: attendance.filter(a => a.status === 'VALID').length,
                    flagged: attendance.filter(a => a.status === 'FLAGGED').length,
                    rejected: attendance.filter(a => a.status === 'REJECTED').length
                },
                locationStats: {
                    averageDistance: Math.round(
                        attendance.reduce((sum, a) => sum + (a.distance_from_event || 0), 0) / attendance.length
                    ),
                    maxDistance: Math.max(...attendance.map(a => a.distance_from_event || 0)),
                    minDistance: Math.min(...attendance.map(a => a.distance_from_event || 0))
                },
                timeRange: {
                    firstSubmission: Math.min(...attendance.map(a => new Date(a.timestamp).getTime())),
                    lastSubmission: Math.max(...attendance.map(a => new Date(a.timestamp).getTime()))
                },
                records: attendance.map(record => ({
                    uid: record.uid,
                    timestamp: record.timestamp,
                    status: record.status,
                    distance: record.distance_from_event
                }))
            };

            return {
                success: true,
                report
            };
        } catch (error) {
            console.error('Report generation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Export attendance data
     */
    static async exportAttendanceData(eventId, format = 'json') {
        try {
            const attendance = await Attendance.find({ event_id: eventId }).lean();

            if (format === 'csv') {
                return this.convertToCSV(attendance);
            }

            return {
                success: true,
                data: attendance
            };
        } catch (error) {
            console.error('Export error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    static convertToCSV(data) {
        const headers = ['UID', 'Timestamp', 'Status', 'Distance', 'Latitude', 'Longitude'];
        const rows = data.map(record => [
            record.uid,
            new Date(record.timestamp).toISOString(),
            record.status,
            record.distance_from_event || 'N/A',
            record.latitude,
            record.longitude
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        return {
            success: true,
            data: csvContent,
            filename: `attendance_${Date.now()}.csv`
        };
    }
}

module.exports = AttendanceIntegration;
