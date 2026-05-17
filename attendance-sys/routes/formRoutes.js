const express = require('express');
const router = express.Router();
const formController = require('../controllers/formController');

// ════════════════════════════════════════════════════════════════
// FORM ROUTES - /api/forms base route
// ════════════════════════════════════════════════════════════════

// Create form
router.post('/', formController.createForm);
router.post('/create', formController.createForm); // Alias for backward compatibility

// Get all forms (new endpoint)
router.get('/', formController.getAllForms);

// Get form responses (must be before :formId route)
router.get('/:formId/responses', formController.getFormResponses);

// Get form by ID
router.get('/:formId', formController.getForm);

// Get organizer forms
router.get('/organizer/:organizerId', formController.getOrganizerForms);

// Update form
router.put('/:formId', formController.updateForm);

// Delete form
router.delete('/:formId', formController.deleteForm);

module.exports = router;
