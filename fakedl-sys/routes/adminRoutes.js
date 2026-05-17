const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.get('/requests', adminController.getAllRequests);
router.get('/request/:dlId', adminController.getRequest);
router.put('/verify/:dlId', adminController.verifyRequest);
router.put('/decision/:dlId', adminController.makeDecision);

module.exports = router;
