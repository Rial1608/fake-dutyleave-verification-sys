require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// ════════════════════════════════════════════════════════════════
// ABSOLUTE PATH CONFIGURATION
// ════════════════════════════════════════════════════════════════
const SYSTEM_ROOT = __dirname;
const FRONTEND_DIR = path.join(SYSTEM_ROOT, 'frontend');
const UPLOADS_DIR = path.join(SYSTEM_ROOT, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Setup database (async)
const setupDatabase = require('./database/setup');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Serve static files using absolute paths
app.use(express.static(FRONTEND_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));

// MongoDB readiness check middleware — prevents API hangs if DB disconnects
const requireMongoReady = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    console.error(`❌ [DB] MongoDB not connected (state: ${mongoose.connection.readyState}) — rejecting ${req.method} ${req.path}`);
    return res.status(503).json({ 
      success: false, 
      error: 'Database not available. Please try again in a moment.' 
    });
  }
  next();
};

// API Routes - using /api/dl base route
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const adminRoutes = require('./routes/adminRoutes');

app.use('/api/dl/auth', authRoutes);
app.use('/api/dl/student', requireMongoReady, studentRoutes);
app.use('/api/dl/admin', requireMongoReady, adminRoutes);

// Serve Google Maps API key to frontend
app.get('/api/dl/config/maps-key', (req, res) => {
  const key = process.env.GOOGLE_MAPS_API_KEY || '';
  const valid = key && key !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE';
  res.json({ key: valid ? key : '', configured: valid });
});

// Health check endpoint
app.get('/api/dl/health', (req, res) => {
  res.json({
    status: 'OK',
    storage: 'mongodb',
    mongoState: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown',
    database: mongoose.connection.db ? mongoose.connection.db.databaseName : null,
    timestamp: new Date().toISOString()
  });
});

// Serve frontend pages
app.get('/', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'index.html')));
app.get('/student-dashboard', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'student-dashboard.html')));
app.get('/apply-dl', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'apply-dl.html')));
app.get('/dl-status', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'dl-status.html')));
app.get('/admin-dashboard', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'admin-dashboard.html')));

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Setup database — MUST succeed before starting
    await setupDatabase();

    app.listen(PORT, () => {
      console.log(`\n🚀 Fake DL Verification System running at http://localhost:${PORT}`);
      console.log(`\n📋 Endpoints:`);
      console.log(`   Base URL: http://localhost:${PORT}`);
      console.log(`   API Base: http://localhost:${PORT}/api/dl`);
      console.log(`   Health:   http://localhost:${PORT}/api/dl/health`);
      console.log(`\n📋 Login Credentials (from database/users.json):`);
      console.log(`   Student: 25BCS13539 / 16JUL2006`);
      console.log(`   Student: 25BCS13541 / 26NOV2006`);
      console.log(`   Admin:   ADMIN01 / admin123`);

      console.log(`\n${'═'.repeat(55)}`);
      console.log(`   ✅ STORAGE MODE: MONGODB ATLAS`);
      console.log(`   ✅ Database: ${mongoose.connection.db.databaseName}`);
      console.log(`   ✅ Shared with Attendance System`);
      console.log(`${'═'.repeat(55)}\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start Fake DL server:', error.message);
    process.exit(1);
  }
};

startServer();
