/* ════════════════════════════════════════════════════════════════
   ATTENDANCE SYSTEM - INTEGRATION MODULE
   For use in Fake DL System
   ════════════════════════════════════════════════════════════════ */

class AttendanceSystemClient {
  /**
   * Creates an instance of AttendanceSystemClient
   * @param {string} baseUrl - Base URL of attendance system (default: http://localhost:3001)
   */
  constructor(baseUrl = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  /**
   * Verify if a student attended an event using their UID and event ID
   * @param {string} uid - Student UID (e.g., "STU_12345")
   * @param {string} eventId - Event ID from attendance system
   * @returns {Promise<Object>} Attendance record or null
   */
  async verifyAttendance(uid, eventId) {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/attendance/${uid}/${eventId}`
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      return {
        attendanceId: data.attendance.attendanceId,
        uid: data.attendance.uid,
        status: data.attendance.status,
        isValid: data.attendance.status === 'VALID',
        submittedAt: data.attendance.submittedAt,
        distance: data.attendance.distance,
        location: {
          latitude: data.attendance.location.latitude,
          longitude: data.attendance.location.longitude,
          accuracy: data.attendance.location.accuracy
        },
        responses: data.attendance.responses
      };
    } catch (error) {
      console.error('Attendance verification error:', error);
      return null;
    }
  }

  /**
   * Get all attendance records for a specific event
   * @param {string} eventId - Event ID
   * @returns {Promise<Object>} Event stats and attendance records
   */
  async getEventAttendance(eventId) {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/attendance/event/${eventId}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Event attendance fetch error:', error);
      return null;
    }
  }

  /**
   * Get detailed form information
   * @param {string} formId - Form ID
   * @returns {Promise<Object>} Form details including fields
   */
  async getFormDetails(formId) {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/forms/${formId}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Form details fetch error:', error);
      return null;
    }
  }

  /**
   * Get all responses for a specific form
   * @param {string} formId - Form ID
   * @returns {Promise<Object>} Form and response records
   */
  async getFormResponses(formId) {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/forms/${formId}/responses`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Form responses fetch error:', error);
      return null;
    }
  }

  /**
   * Check if a student has submitted attendance for an event
   * @param {string} uid - Student UID
   * @param {string} eventId - Event ID
   * @returns {Promise<boolean>} True if attended, false otherwise
   */
  async hasAttended(uid, eventId) {
    const attendance = await this.verifyAttendance(uid, eventId);
    return attendance !== null;
  }

  /**
   * Check if attendance is valid (within location range)
   * @param {string} uid - Student UID
   * @param {string} eventId - Event ID
   * @returns {Promise<boolean>} True if valid, false otherwise
   */
  async isValidAttendance(uid, eventId) {
    const attendance = await this.verifyAttendance(uid, eventId);
    return attendance?.isValid ?? false;
  }

  /**
   * Get distance from event location (in meters)
   * @param {string} uid - Student UID
   * @param {string} eventId - Event ID
   * @returns {Promise<number|null>} Distance in meters or null
   */
  async getAttendanceDistance(uid, eventId) {
    const attendance = await this.verifyAttendance(uid, eventId);
    return attendance?.distance ?? null;
  }

  /**
   * Get event statistics
   * @param {string} eventId - Event ID
   * @returns {Promise<Object|null>} Stats object with totals
   */
  async getEventStats(eventId) {
    const data = await this.getEventAttendance(eventId);
    return data?.stats ?? null;
  }

  /**
   * Calculate verification score (0-100)
   * Based on location accuracy and submission status
   * @param {string} uid - Student UID
   * @param {string} eventId - Event ID
   * @returns {Promise<number>} Score (0-100)
   */
  async calculateVerificationScore(uid, eventId) {
    try {
      const attendance = await this.verifyAttendance(uid, eventId);

      if (!attendance) {
        return 0; // No attendance = 0 score
      }

      let score = 0;

      // Valid status = 50 points
      if (attendance.isValid) {
        score += 50;
      }

      // Location accuracy = up to 30 points
      if (attendance.location.accuracy) {
        const accuracyScore = Math.max(0, 30 - (attendance.location.accuracy / 10));
        score += accuracyScore;
      } else {
        score += 20;
      }

      // Close distance = up to 20 points
      if (attendance.distance < 50) {
        score += 20;
      } else if (attendance.distance < 100) {
        score += 10;
      }

      return Math.min(100, Math.round(score));
    } catch (error) {
      console.error('Score calculation error:', error);
      return 0;
    }
  }

  /**
   * Batch verify multiple students
   * @param {Array} students - Array of {uid, eventId} objects
   * @returns {Promise<Array>} Array of verification results
   */
  async batchVerifyAttendance(students) {
    try {
      const results = await Promise.all(
        students.map(async (student) => ({
          uid: student.uid,
          eventId: student.eventId,
          data: await this.verifyAttendance(student.uid, student.eventId)
        }))
      );

      return results;
    } catch (error) {
      console.error('Batch verification error:', error);
      return [];
    }
  }

  /**
   * Generate a verification report
   * @param {string} eventId - Event ID
   * @returns {Promise<Object>} Report with stats and breakdown
   */
  async generateVerificationReport(eventId) {
    try {
      const data = await this.getEventAttendance(eventId);

      if (!data) {
        return null;
      }

      const { stats, attendance } = data;

      // Additional analysis
      const validEntries = attendance.filter(a => a.status === 'VALID');
      const flaggedEntries = attendance.filter(a => a.status === 'FLAGGED');

      const avgDistance = validEntries.length > 0
        ? validEntries.reduce((sum, a) => sum + a.distance, 0) / validEntries.length
        : 0;

      const report = {
        eventId,
        generatedAt: new Date().toISOString(),
        summary: {
          totalSubmissions: stats.totalSubmissions,
          validEntries: stats.validEntries,
          flaggedEntries: stats.flaggedEntries,
          averageDistance: Math.round(stats.averageDistance),
          verificationRate: stats.totalSubmissions > 0 
            ? ((stats.validEntries / stats.totalSubmissions) * 100).toFixed(2) + '%'
            : 'N/A'
        },
        details: {
          validCount: validEntries.length,
          flaggedCount: flaggedEntries.length,
          averageDistanceValid: Math.round(avgDistance)
        },
        entries: attendance
      };

      return report;
    } catch (error) {
      console.error('Report generation error:', error);
      return null;
    }
  }

  /**
   * Check system health
   * @returns {Promise<boolean>} True if system is healthy
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      return response.ok;
    } catch (error) {
      console.error('Health check error:', error);
      return false;
    }
  }
}

// Export for use in Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AttendanceSystemClient;
}

// ════════════════════════════════════════════════════════════════
// USAGE EXAMPLES
// ════════════════════════════════════════════════════════════════

// Example 1: Simple verification
/*
const client = new AttendanceSystemClient('http://localhost:3001');
const isValid = await client.isValidAttendance('STU_12345', 'event_xyz');
console.log('Student attended:', isValid);
*/

// Example 2: Get detailed attendance
/*
const client = new AttendanceSystemClient();
const attendance = await client.verifyAttendance('STU_12345', 'event_xyz');
if (attendance) {
  console.log('Status:', attendance.status);
  console.log('Distance:', attendance.distance, 'meters');
  console.log('Accuracy:', attendance.location.accuracy, 'meters');
}
*/

// Example 3: Get event statistics
/*
const client = new AttendanceSystemClient();
const stats = await client.getEventStats('event_xyz');
console.log('Total submissions:', stats.totalSubmissions);
console.log('Valid entries:', stats.validEntries);
console.log('Average distance:', stats.averageDistance);
*/

// Example 4: Batch verification
/*
const client = new AttendanceSystemClient();
const students = [
  { uid: 'STU_12345', eventId: 'event_xyz' },
  { uid: 'STU_12346', eventId: 'event_xyz' },
  { uid: 'STU_12347', eventId: 'event_xyz' }
];
const results = await client.batchVerifyAttendance(students);
results.forEach(result => {
  console.log(`${result.uid}: ${result.data?.status ?? 'NOT_ATTENDED'}`);
});
*/

// Example 5: Generate verification report
/*
const client = new AttendanceSystemClient();
const report = await client.generateVerificationReport('event_xyz');
console.log('Report generated:', report.generatedAt);
console.log('Verification rate:', report.summary.verificationRate);
console.log('Valid entries:', report.summary.validEntries);
*/

// ════════════════════════════════════════════════════════════════
// INTEGRATION WITH FAKE DL SYSTEM
// ════════════════════════════════════════════════════════════════

/*
// In your DL approval module:

const attendanceClient = new AttendanceSystemClient('http://localhost:3001');

async function approveDutyLeave(studentData) {
  const { uid, eventId, dlReason, dlDates } = studentData;

  // Step 1: Verify attendance
  const attendance = await attendanceClient.verifyAttendance(uid, eventId);
  
  if (!attendance) {
    return { approved: false, reason: 'No attendance record found' };
  }

  // Step 2: Check validity
  if (!attendance.isValid) {
    return { approved: false, reason: 'Attendance location flagged', distance: attendance.distance };
  }

  // Step 3: Check attendance date against DL dates
  const attendanceDate = new Date(attendance.submittedAt);
  const dlStart = new Date(dlDates.start);
  const dlEnd = new Date(dlDates.end);

  if (attendanceDate < dlStart || attendanceDate > dlEnd) {
    return { approved: false, reason: 'Attendance date outside DL period' };
  }

  // Step 4: Approve
  return {
    approved: true,
    reason: 'Attendance verified',
    verified: {
      attendanceId: attendance.attendanceId,
      distance: attendance.distance,
      submittedAt: attendance.submittedAt
    }
  };
}
*/
