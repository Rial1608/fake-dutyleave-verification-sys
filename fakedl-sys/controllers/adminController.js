const dutyLeaveModel = require('../models/dutyLeaveModel');
const { runVerification } = require('../utils/fakeDetection');

const adminController = {
  async getAllRequests(req, res) {
    try {
      console.log("🔷 [API HIT] GET /api/dl/admin/requests");
      
      const user = req.session.user;
      console.log("   User session:", user ? `${user.name} (${user.role})` : "NO SESSION");
      
      if (!user || user.role !== 'admin') {
        console.log("   ❌ Auth check failed - returning 403");
        return res.status(403).json({ error: 'Admin access required' });
      }

      console.log("   ✅ Auth passed, fetching requests from database...");
      const requests = await dutyLeaveModel.findAll();
      const stats = await dutyLeaveModel.getAdminStats();
      
      console.log(`   📊 Found ${requests.length} requests, stats:`, stats);
      res.json({ success: true, requests, stats });
    } catch (error) {
      console.error('❌ [API ERROR] Admin getAllRequests:', error.message);
      console.error('   Stack:', error);
      res.status(500).json({ error: 'Failed to load requests', details: error.message });
    }
  },

  async getRequest(req, res) {
    try {
      console.log("🔷 [API HIT] GET /api/dl/admin/request/:dlId");
      
      const user = req.session.user;
      console.log("   User session:", user ? `${user.name} (${user.role})` : "NO SESSION");
      
      if (!user || user.role !== 'admin') {
        console.log("   ❌ Auth check failed - returning 403");
        return res.status(403).json({ error: 'Admin access required' });
      }

      const dlId = parseInt(req.params.dlId);
      console.log(`   ✅ Auth passed, fetching request DL-${dlId}...`);
      
      const request = await dutyLeaveModel.findById(dlId);
      if (!request) {
        console.log(`   ❌ Request not found: DL-${dlId}`);
        return res.status(404).json({ error: 'Request not found' });
      }

      console.log(`   📊 Found request for student: ${request.student_id}`);
      res.json({ success: true, request });
    } catch (error) {
      console.error('❌ [API ERROR] Admin getRequest:', error.message);
      console.error('   Stack:', error);
      res.status(500).json({ error: 'Failed to load request', details: error.message });
    }
  },

  async verifyRequest(req, res) {
    try {
      console.log("🔷 [API HIT] PUT /api/dl/admin/verify/:dlId");
      
      const user = req.session.user;
      console.log("   User session:", user ? `${user.name} (${user.role})` : "NO SESSION");
      
      if (!user || user.role !== 'admin') {
        console.log("   ❌ Auth check failed - returning 403");
        return res.status(403).json({ error: 'Admin access required' });
      }

      const dlId = parseInt(req.params.dlId);
      console.log(`   ✅ Auth passed, fetching request DL-${dlId} for verification...`);
      
      const dlRecord = await dutyLeaveModel.findById(dlId);
      if (!dlRecord) {
        console.log(`   ❌ Request not found: DL-${dlId}`);
        return res.status(404).json({ error: 'Request not found' });
      }

      console.log(`\n🔍 [VERIFY] Running verification for DL-${dlId}...`);
      const verification = await runVerification(dlRecord);
      console.log(`   Score: ${verification.score}, Summary: ${verification.summary}`);

      res.json({ success: true, verification });
    } catch (error) {
      console.error('❌ [API ERROR] Admin verify error:', error.message);
      console.error('   Stack:', error);
      res.status(500).json({ error: 'Failed to verify request', details: error.message });
    }
  },

  async makeDecision(req, res) {
    try {
      console.log("🔷 [API HIT] PUT /api/dl/admin/decision/:dlId");
      
      const user = req.session.user;
      console.log("   User session:", user ? `${user.name} (${user.role})` : "NO SESSION");
      
      if (!user || user.role !== 'admin') {
        console.log("   ❌ Auth check failed - returning 403");
        return res.status(403).json({ error: 'Admin access required' });
      }

      const dlId = parseInt(req.params.dlId);
      let { status, flag_reasons } = req.body;

      if (status) status = status.toLowerCase();

      if (!['approved', 'rejected', 'flagged'].includes(status)) {
        console.log(`   ❌ Invalid status: ${status}`);
        return res.status(400).json({ error: 'Invalid status. Must be: approved, rejected, or flagged' });
      }

      console.log(`   ✅ Auth passed, updating DL-${dlId} status to: ${status}`);
      await dutyLeaveModel.updateStatus(dlId, status, flag_reasons || null);
      console.log(`📝 [DECISION] DL-${dlId} → ${status.toUpperCase()}`);
      
      res.json({ success: true, message: `DL request marked as ${status}` });
    } catch (error) {
      console.error('❌ [API ERROR] Admin decision error:', error.message);
      console.error('   Stack:', error);
      res.status(500).json({ error: 'Failed to update decision', details: error.message });
    }
  }
};

module.exports = adminController;
