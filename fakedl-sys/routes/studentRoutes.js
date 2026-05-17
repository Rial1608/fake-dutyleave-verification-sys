const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const studentController = require('../controllers/studentController');

// ════════════════════════════════════════════════════════════════
// UPLOAD CONFIGURATION - Absolute Paths
// Files are stored in the uploads directory with absolute path
// ════════════════════════════════════════════════════════════════
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// Configure multer for file uploads with absolute destination path
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|csv|txt|xlsx/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase().slice(1));
    if (mimetype || extname) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type'));
  }
});

const uploadFields = upload.fields([
  { name: 'gps_photo', maxCount: 1 },
  { name: 'supporting_doc', maxCount: 1 }
]);

router.get('/dashboard', studentController.getDashboard);
router.post('/apply-dl', uploadFields, studentController.applyDL);
router.get('/dl-status', studentController.getDLStatus);
router.get('/geocode', studentController.geocode);

module.exports = router;
