const Form = require('../models/formModel');
const Attendance = require('../models/attendanceModel');
const QRCode = require('qrcode');
const { demoMode } = require('../database/connection');

// ════════════════════════════════════════════════════════════════
// FORM BUILDER CONTROLLER
// ════════════════════════════════════════════════════════════════

const generateQRCode = async (formLink) => {
  try {
    const qrCode = await QRCode.toDataURL(formLink);
    return qrCode;
  } catch (error) {
    console.error('QR Code generation error:', error);
    return null;
  }
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Helper to safely convert responses to plain object
const responsesToObject = (responses) => {
  if (!responses) return {};
  if (typeof responses === 'object' && !responses.entries) return responses;
  try {
    if (responses instanceof Map) return Object.fromEntries(responses);
    if (typeof responses === 'string') return JSON.parse(responses);
    return responses;
  } catch {
    return responses;
  }
};

// Create Form
exports.createForm = async (req, res) => {
  try {
    console.log('\n📥 [FORM CREATE] Received request');
    console.log('   Storage mode:', demoMode.enabled ? '⚠️  DEMO (in-memory)' : '✅ MONGODB');

    const { eventName: rawEventName, eventLocation, eventDateTime, fields, description, organizerId, organizerName, maxLocationDistance } = req.body;

    // Normalize event name to lowercase for case-insensitive matching
    const eventName = (rawEventName || '').trim().toLowerCase();

    // Validate input
    if (!eventName || !eventLocation || !fields || fields.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const formId = `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const formLink = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/form/${formId}`;
    const qrCode = await generateQRCode(formLink);

    const formData = {
      formId,
      eventId,
      eventName,
      eventLocation: {
        latitude: eventLocation.latitude,
        longitude: eventLocation.longitude,
        address: eventLocation.address
      },
      eventDateTime: new Date(eventDateTime),
      fields: fields.map((field, index) => ({
        id: field.id || `field_${index}_${Date.now()}`,
        label: field.label,
        type: field.type,
        required: field.required ?? true,
        order: index,
        options: field.options || []
      })),
      description,
      organizerId: organizerId || 'default_org',
      organizerName: organizerName || 'Organizer',
      maxLocationDistance: maxLocationDistance || 100,
      qrCode: qrCode,
      createdAt: new Date(),
      isActive: true
    };

    if (demoMode.enabled) {
      // Use in-memory demo storage — DATA WILL NOT PERSIST
      console.log('⚠️  [FORM] Saving to IN-MEMORY storage (demo mode)');
      console.log('   ⚠️  This form will NOT appear in MongoDB Atlas!');
      demoMode.forms[formId] = formData;
      return res.status(201).json({
        message: 'Form created (DEMO MODE — not saved to MongoDB)',
        storage: 'memory',
        form: { ...formData, formLink }
      });
    }

    console.log('💾 [FORM] Saving to MongoDB...');
    const form = new Form(formData);
    const savedDoc = await form.save();
    console.log('✅ [FORM] Saved to MongoDB successfully!');
    console.log(`   _id: ${savedDoc._id}`);
    console.log(`   formId: ${savedDoc.formId}`);
    console.log(`   eventName: ${savedDoc.eventName}`);

    return res.status(201).json({
      message: 'Form created successfully',
      storage: 'mongodb',
      form: {
        ...formData,
        formLink
      }
    });
  } catch (error) {
    console.error('Form creation error:', error);
    return res.status(500).json({ error: 'Failed to create form', details: error.message });
  }
};

// Get Form
exports.getForm = async (req, res) => {
  try {
    const { formId } = req.params;

    if (demoMode.enabled) {
      // Use in-memory demo storage
      const form = demoMode.forms[formId];
      if (!form) {
        return res.status(404).json({ error: 'Form not found' });
      }

      return res.status(200).json({
        form: {
          formId: form.formId,
          eventId: form.eventId,
          eventName: form.eventName,
          eventLocation: form.eventLocation,
          eventDateTime: form.eventDateTime,
          description: form.description,
          fields: form.fields.sort((a, b) => a.order - b.order),
          maxLocationDistance: form.maxLocationDistance
        }
      });
    }

    const form = await Form.findOne({ formId });
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }

    return res.status(200).json({
      form: {
        formId: form.formId,
        eventId: form.eventId,
        eventName: form.eventName,
        eventLocation: form.eventLocation,
        eventDateTime: form.eventDateTime,
        description: form.description,
        fields: form.fields.sort((a, b) => a.order - b.order),
        maxLocationDistance: form.maxLocationDistance
      }
    });
  } catch (error) {
    console.error('Get form error:', error);
    return res.status(500).json({ error: 'Failed to fetch form' });
  }
};

// Get All Forms
exports.getAllForms = async (req, res) => {
  try {
    if (demoMode.enabled) {
      // Use in-memory demo storage
      const forms = Object.values(demoMode.forms);
      const formsWithStats = forms.map((form) => {
        const attendanceCount = Object.values(demoMode.attendance || {}).filter(a => a.formId === form.formId).length;
        const formLink = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/form/${form.formId}`;
        return {
          formId: form.formId,
          eventId: form.eventId,
          eventName: form.eventName,
          eventDateTime: form.eventDateTime,
          eventLocation: form.eventLocation,
          attendanceCount,
          fieldCount: form.fields.length,
          organizerId: form.organizerId,
          organizerName: form.organizerName,
          createdAt: form.createdAt,
          qrCode: form.qrCode,
          formLink
        };
      });
      return res.status(200).json({ forms: formsWithStats.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
    }

    const forms = await Form.find().sort({ createdAt: -1 });

    const formsWithStats = await Promise.all(
      forms.map(async (form) => {
        const attendanceCount = await Attendance.countDocuments({ formId: form.formId });
        const formLink = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/form/${form.formId}`;
        return {
          formId: form.formId,
          eventId: form.eventId,
          eventName: form.eventName,
          eventDateTime: form.eventDateTime,
          eventLocation: form.eventLocation,
          attendanceCount,
          fieldCount: form.fields.length,
          organizerId: form.organizerId,
          organizerName: form.organizerName,
          createdAt: form.createdAt,
          qrCode: form.qrCode,
          formLink
        };
      })
    );

    return res.status(200).json({ forms: formsWithStats });
  } catch (error) {
    console.error('Get all forms error:', error);
    return res.status(500).json({ error: 'Failed to fetch forms' });
  }
};

// Get Organizer Forms
exports.getOrganizerForms = async (req, res) => {
  try {
    const { organizerId } = req.params;

    if (demoMode.enabled) {
      // Use in-memory demo storage
      const forms = Object.values(demoMode.forms).filter(f => f.organizerId === organizerId);
      const formsWithStats = forms.map((form) => {
        const attendanceCount = Object.values(demoMode.attendance || {}).filter(a => a.formId === form.formId).length;
        const formLink = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/form/${form.formId}`;
        return {
          formId: form.formId,
          eventId: form.eventId,
          eventName: form.eventName,
          eventDateTime: form.eventDateTime,
          attendanceCount,
          fieldCount: form.fields.length,
          createdAt: form.createdAt,
          qrCode: form.qrCode,
          formLink
        };
      });
      return res.status(200).json({ forms: formsWithStats.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
    }

    const forms = await Form.find({ organizerId }).sort({ createdAt: -1 });

    const formsWithStats = await Promise.all(
      forms.map(async (form) => {
        const attendanceCount = await Attendance.countDocuments({ formId: form.formId });
        const formLink = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/form/${form.formId}`;
        return {
          formId: form.formId,
          eventId: form.eventId,
          eventName: form.eventName,
          eventDateTime: form.eventDateTime,
          attendanceCount,
          fieldCount: form.fields.length,
          createdAt: form.createdAt,
          qrCode: form.qrCode,
          formLink
        };
      })
    );

    return res.status(200).json({ forms: formsWithStats });
  } catch (error) {
    console.error('Get organizer forms error:', error);
    return res.status(500).json({ error: 'Failed to fetch forms' });
  }
};

// Get Form Responses
exports.getFormResponses = async (req, res) => {
  try {
    const { formId } = req.params;

    if (demoMode.enabled) {
      const form = demoMode.forms[formId];
      if (!form) {
        return res.status(404).json({ error: 'Form not found' });
      }
      const responses = Object.values(demoMode.attendance || {}).filter(a => a.formId === formId);
      return res.status(200).json({
        form: {
          eventName: form.eventName,
          totalResponses: responses.length
        },
        responses: responses.map(r => ({
          attendanceId: r.attendanceId,
          uid: r.uid,
          responses: responsesToObject(r.responses),
          location: r.location,
          distance: r.distance,
          status: r.status,
          submittedAt: r.submittedAt
        }))
      });
    }

    const form = await Form.findOne({ formId });
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const responses = await Attendance.find({ formId }).sort({ submittedAt: -1 });

    return res.status(200).json({
      form: {
        eventName: form.eventName,
        totalResponses: responses.length
      },
      responses: responses.map(r => ({
        attendanceId: r.attendanceId,
        uid: r.uid,
        responses: responsesToObject(r.responses),
        location: r.location,
        distance: r.distance,
        status: r.status,
        submittedAt: r.submittedAt
      }))
    });
  } catch (error) {
    console.error('Get form responses error:', error);
    return res.status(500).json({ error: 'Failed to fetch responses' });
  }
};

// Update Form
exports.updateForm = async (req, res) => {
  try {
    const { formId } = req.params;
    const { eventName, eventLocation, fields, description, maxLocationDistance } = req.body;

    const form = await Form.findOne({ formId });
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }

    // Check if form has responses
    const responseCount = await Attendance.countDocuments({ formId });
    if (responseCount > 0) {
      return res.status(400).json({ error: 'Cannot update form after responses received' });
    }

    if (eventName) form.eventName = eventName;
    if (eventLocation) form.eventLocation = eventLocation;
    if (description) form.description = description;
    if (maxLocationDistance) form.maxLocationDistance = maxLocationDistance;
    
    if (fields && fields.length > 0) {
      form.fields = fields.map((field, index) => ({
        id: field.id || `field_${index}_${Date.now()}`,
        label: field.label,
        type: field.type,
        required: field.required ?? true,
        order: index,
        options: field.options || []
      }));
    }

    form.updatedAt = new Date();
    await form.save();

    return res.status(200).json({
      message: 'Form updated successfully',
      form: { formId: form.formId, eventName: form.eventName }
    });
  } catch (error) {
    console.error('Form update error:', error);
    return res.status(500).json({ error: 'Failed to update form' });
  }
};

// Delete Form
exports.deleteForm = async (req, res) => {
  try {
    const { formId } = req.params;

    if (demoMode.enabled) {
      if (!demoMode.forms[formId]) {
        return res.status(404).json({ error: 'Form not found' });
      }
      delete demoMode.forms[formId];
      // Also delete related attendance records
      Object.keys(demoMode.attendance || {}).forEach(key => {
        if (demoMode.attendance[key].formId === formId) {
          delete demoMode.attendance[key];
        }
      });
      return res.status(200).json({ message: 'Form deleted successfully' });
    }

    const form = await Form.findOneAndDelete({ formId });
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }

    await Attendance.deleteMany({ formId });

    return res.status(200).json({ message: 'Form deleted successfully' });
  } catch (error) {
    console.error('Form deletion error:', error);
    return res.status(500).json({ error: 'Failed to delete form' });
  }
};
