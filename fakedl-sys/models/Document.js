const mongoose = require('mongoose');

// ════════════════════════════════════════════════════════════════
// DOCUMENT SCHEMA — stored in 'dldocuments' collection
// Linked to DutyLeave via dlId
// ════════════════════════════════════════════════════════════════

const documentSchema = new mongoose.Schema({
  dlId: {
    type: Number,
    required: true,
    index: true
  },
  gpsPhoto: {
    type: String,
    default: null
  },
  supportingDoc: {
    type: String,
    default: null
  },
  gpsPhotoHash: {
    type: String,
    default: null
  },
  supportingDocHash: {
    type: String,
    default: null
  },
  photoLat: {
    type: Number,
    default: null
  },
  photoLng: {
    type: Number,
    default: null
  }
}, {
  timestamps: false,
  collection: 'dldocuments'
});

module.exports = mongoose.model('DLDocument', documentSchema);
