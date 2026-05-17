require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// ════════════════════════════════════════════════════════════════
// ABSOLUTE PATH CONFIGURATION
// All file operations use __dirname for absolute paths
// ════════════════════════════════════════════════════════════════
const SYSTEM_ROOT = __dirname;
const FRONTEND_DIR = path.join(SYSTEM_ROOT, 'frontend');
const UPLOADS_DIR = path.join(SYSTEM_ROOT, 'uploads');
const DATABASE_DIR = path.join(SYSTEM_ROOT, 'database');

// Ensure required directories exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(DATABASE_DIR)) {
  fs.mkdirSync(DATABASE_DIR, { recursive: true });
}

// Setup database
const setupDatabase = require('./database/setup');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Serve static files using absolute paths
app.use(express.static(FRONTEND_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));

// API Routes
const attendanceRoutes = require('./routes/attendanceRoutes');
const formRoutes = require('./routes/formRoutes');

app.use('/api/attendance', attendanceRoutes);
app.use('/api/forms', formRoutes);

// Serve frontend pages using absolute paths
app.get('/', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'index.html')));
app.get('/organizer', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'organizer.html')));
app.get('/form/:formId', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'student-form.html')));

// Health check with storage mode info
const { demoMode } = require('./database/connection');
const mongoose = require('mongoose');

app.get('/api/health', (req, res) => res.json({
  status: 'OK',
  storage: demoMode.enabled ? 'memory (DEMO MODE)' : 'mongodb',
  mongoState: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown',
  database: !demoMode.enabled && mongoose.connection.db ? mongoose.connection.db.databaseName : null,
  timestamp: new Date().toISOString()
}));

const PORT = process.env.PORT || 3001;

const startServer = async () => {
  try {
    // Setup database
    await setupDatabase();
    
    app.listen(PORT, () => {
      console.log(`\n🚀 Attendance System running at http://localhost:${PORT}`);
      console.log(`\n📋 Endpoints:`);
      console.log(`   🏠 Home: http://localhost:${PORT}`);
      console.log(`   👔 Organizer Panel: http://localhost:${PORT}/organizer`);
      console.log(`   📋 Forms API: http://localhost:${PORT}/api/forms`);
      console.log(`   ✅ Attendance API: http://localhost:${PORT}/api/attendance`);

      // Clear storage mode banner
      console.log(`\n${'═'.repeat(55)}`);
      if (demoMode.enabled) {
        console.log(`   ⚠️  STORAGE MODE: DEMO (IN-MEMORY)`);
        console.log(`   ⚠️  Data will NOT be saved to MongoDB Atlas!`);
        console.log(`   ⚠️  Likely cause: IP not whitelisted in Atlas`);
        console.log(`   ℹ️  Go to Atlas → Network Access → Add Current IP`);
      } else {
        console.log(`   ✅ STORAGE MODE: MONGODB`);
        console.log(`   ✅ Data WILL be saved to MongoDB Atlas`);
        console.log(`   📦 Database: ${mongoose.connection.db.databaseName}`);
      }
      console.log(`${'═'.repeat(55)}\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
