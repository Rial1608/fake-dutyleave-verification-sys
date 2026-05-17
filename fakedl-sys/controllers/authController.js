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

const authController = {
  login(req, res) {
    let { student_id, password } = req.body;
    if (!student_id || !password) {
      return res.status(400).json({ error: 'UID and password are required' });
    }

    // Normalize UID to lowercase for case-insensitive matching
    student_id = student_id.trim().toLowerCase();

    const users = loadUsers();
    const user = users.find(u => u.uid.toLowerCase() === student_id && u.password === password);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Store user in session
    const sessionUser = {
      student_id: user.uid,
      name: user.name,
      role: user.role,
      email: user.email,
      department: user.department
    };
    req.session.user = sessionUser;
    res.json({ success: true, user: sessionUser });
  },

  logout(req, res) {
    console.log("🔷 [API HIT] POST /api/dl/auth/logout");
    req.session.destroy((err) => {
      if (err) {
        console.error("❌ Error destroying session:", err);
        return res.status(500).json({ success: false, error: 'Failed to logout' });
      }
      console.log("✅ Session destroyed successfully");
      res.json({ success: true });
    });
  },

  getSession(req, res) {
    if (req.session && req.session.user) {
      res.json({ loggedIn: true, user: req.session.user });
    } else {
      res.json({ loggedIn: false });
    }
  }
};

module.exports = authController;
