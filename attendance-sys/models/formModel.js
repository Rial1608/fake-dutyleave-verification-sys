const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema({
  id: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, enum: ['text', 'dropdown', 'number', 'email', 'tel'], required: true },
  required: { type: Boolean, default: true },
  order: { type: Number, required: true },
  options: [String] // For dropdown fields
}, { _id: false });

const formSchema = new mongoose.Schema({
  formId: { type: String, unique: true, required: true },
  eventId: { type: String, required: true },
  eventName: { type: String, required: true },
  eventLocation: { 
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    address: { type: String }
  },
  eventDateTime: { type: Date, required: true },
  fields: [fieldSchema],
  description: { type: String },
  organizerId: { type: String, required: true },
  organizerName: { type: String, required: true },
  qrCode: { type: String }, // Base64 encoded QR code
  isActive: { type: Boolean, default: true },
  maxLocationDistance: { type: Number, default: 100 }, // in meters
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Form', formSchema);
