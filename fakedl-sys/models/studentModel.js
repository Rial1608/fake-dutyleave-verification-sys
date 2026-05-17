const fs = require('fs');
const path = require('path');

// ════════════════════════════════════════════════════════════════
// USER DATABASE - Absolute Path
// Users.json is stored in the database directory with absolute path
// ════════════════════════════════════════════════════════════════
const USERS_FILE = path.join(__dirname, '..', 'database', 'users.json');

function loadUsers() {
  const data = fs.readFileSync(USERS_FILE, 'utf-8');
  return JSON.parse(data).users;
}

const studentModel = {
  findById(studentId) {
    const users = loadUsers();
    const normalizedId = (studentId || '').trim().toLowerCase();
    const user = users.find(u => u.uid.toLowerCase() === normalizedId);
    if (!user) return null;
    return {
      student_id: user.uid,
      name: user.name,
      email: user.email,
      department: user.department,
      role: user.role
    };
  }
};

module.exports = studentModel;
