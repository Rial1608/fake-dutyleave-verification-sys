document.addEventListener('DOMContentLoaded', async () => {
  // Check session with timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('/api/dl/auth/session', { signal: controller.signal });
    clearTimeout(timeoutId);
    
    const session = await response.json();
    
    if (!session.loggedIn || !session.user || session.user.role !== 'admin') {
      console.log("🔐 [AUTH] Unauthorized - redirecting to login");
      window.location.href = '/';
      return;
    }
    
    console.log("✅ [AUTH] Admin authenticated:", session.user.name);
    document.getElementById('adminName').textContent = session.user.name;
  } catch (err) {
    console.error("❌ [AUTH] Session check failed:", err);
    window.location.href = '/';
    return;
  }

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
      console.log("🔓 [LOGOUT] Sending logout request...");
      
      const logoutController = new AbortController();
      const logoutTimeout = setTimeout(() => logoutController.abort(), 5000);
      
      const response = await fetch('/api/dl/auth/logout', { 
        method: 'POST',
        signal: logoutController.signal
      });
      clearTimeout(logoutTimeout);
      
      const data = await response.json();
      
      if (data.success) {
        console.log("✅ [LOGOUT] Logout successful, clearing local storage...");
      } else {
        console.error("❌ [LOGOUT] Server returned error:", data.error);
      }
    } catch (err) {
      console.error("❌ [LOGOUT] Error (will redirect anyway):", err);
    } finally {
      // Always clear storage and redirect, even if API call fails
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('session');
      console.log("➡️  [LOGOUT] Redirecting to login...");
      window.location.href = '/';
    }
  });

  let allRequests = [];
  let currentDLId = null;

  // Haversine distance (km) for coordinate-based campus detection in modal
  function haversineDistanceAdmin(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ==========================================
  // CUSTOM ACTION MODAL
  // ==========================================
  let selectedAction = "";
  let selectedId = "";

  window.openModal = function(action, id) {
    selectedAction = action;
    selectedId = id;

    if (action === 'reject') {
        document.getElementById("modalText").innerText = "Are you sure you want to reject this DL request?";
        document.getElementById("modalTitle").innerText = "Reject";
    } else if (action === 'flag') {
        document.getElementById("modalText").innerText = "Are you sure you want to flag this DL request as suspicious?";
        document.getElementById("modalTitle").innerText = "Flag";
    }

    document.getElementById("actionModal").style.display = "flex";
  };

  window.closeModal = function() {
    document.getElementById("actionModal").style.display = "none";
    // Keep verifyModal working properly when using closeModal
    const verifyModal = document.getElementById('verifyModal');
    if (verifyModal) verifyModal.classList.remove('active');
  };

  document.getElementById("confirmBtn").onclick = async function() {
    let status = selectedAction === "reject" ? "Rejected" : "Flagged";

    await fetch(`/api/dl/admin/decision/${selectedId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status })
    });

    window.closeModal();
    location.reload();
  };

  // Close action modal on backdrop click
  document.getElementById('actionModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) window.closeModal();
  });

  // ==========================================
  // GLOBAL ACTION FUNCTIONS (Table + Modal)
  // ==========================================

  window.updateDecision = async function(dlId, status, flagReasons) {
    try {
      const body = { status };
      if (flagReasons) body.flag_reasons = flagReasons;

      const res = await fetch(`/api/dl/admin/decision/${dlId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Request marked as ${status}`, 'success');
        closeModal();
        await loadRequests(); // Refresh table + stats
      } else {
        showToast(data.error || 'Action failed', 'error');
      }
    } catch (err) {
      showToast('Server error', 'error');
    }
  }

  // ==========================================
  // DATA LOADING
  // ==========================================

  let currentFilter = 'all';

  await loadRequests();

  // Search input
  document.getElementById('searchInput').addEventListener('input', (e) => {
    renderTable(currentFilter);
  });

  // Filter bar
  document.getElementById('filterBar').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderTable(currentFilter);
  });

  // Verify modal close
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('verifyModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  async function loadRequests() {
    try {
      console.log("🔍 [ADMIN] Fetching requests from /api/dl/admin/requests");
      
      // Show loading state
      document.getElementById('requestsBody').innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding:40px;">
            <div style="display:flex; flex-direction:column; align-items:center; gap:12px;">
              <div style="width:40px; height:40px; border:3px solid #e7e8e9; border-top:3px solid #0F3460; border-radius:50%; animation:spin 0.8s linear infinite;"></div>
              <div style="color:#718096; font-size:14px;">Loading requests...</div>
            </div>
          </td>
        </tr>
      `;
      window.requestsLoading = true;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch('/api/dl/admin/requests', { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`❌ [ADMIN] API returned status ${response.status}: ${response.statusText}`);
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('   Error:', errorData);
        throw new Error(`API Error: ${response.status} ${response.statusText}. ${errorData.error || ''}`);
      }

      const data = await response.json();
      console.log("✅ [ADMIN] Data loaded:", data);
      
      if (!data.success) {
        throw new Error(data.error || 'API returned success: false');
      }
      
      allRequests = data.requests || [];
      const stats = data.stats || {};

      document.getElementById('statTotal').textContent = stats.total || 0;
      document.getElementById('statPending').textContent = stats.pending || 0;
      document.getElementById('statApproved').textContent = stats.approved || 0;
      document.getElementById('statRejected').textContent = stats.rejected || 0;
      document.getElementById('statFlagged').textContent = stats.flagged || 0;

      renderTable('all');
      window.requestsLoading = false;
    } catch (err) {
      window.requestsLoading = false;
      let errorMsg = err.message;
      
      if (err.name === 'AbortError') {
        errorMsg = 'Request timeout - server did not respond within 15 seconds. Check MongoDB connection.';
      }
      
      console.error("❌ [ADMIN] Error loading requests:", errorMsg);
      console.error("   Stack:", err);
      
      document.getElementById('requestsBody').innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; color:var(--danger); padding:40px;">
            <div style="display:flex; flex-direction:column; align-items:center; gap:12px;">
              <div style="font-size:40px;">⚠️</div>
              <div><strong>Failed to load requests</strong></div>
              <div style="font-size:12px; color:#718096; max-width:400px;">${errorMsg}</div>
              <button onclick="location.reload()" style="margin-top:12px; padding:8px 16px; background:#0F3460; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:600;">
                🔄 Retry
              </button>
            </div>
          </td>
        </tr>
      `;
    }
  }

  function renderTable(filter) {
    const tbody = document.getElementById('requestsBody');
    const query = (document.getElementById('searchInput').value || '').toLowerCase().trim();
    let filtered = filter === 'all' ? allRequests : allRequests.filter(r => r.status === filter);

    // Apply search filter
    if (query) {
      filtered = filtered.filter(r =>
        (r.student_name || '').toLowerCase().includes(query) ||
        (r.student_id || '').toLowerCase().includes(query) ||
        (r.event_name || '').toLowerCase().includes(query) ||
        (r.dl_type || '').toLowerCase().includes(query) ||
        (r.event_location || '').toLowerCase().includes(query) ||
        (r.campus_type || '').toLowerCase().includes(query) ||
        (r.event_date || '').toLowerCase().includes(query) ||
        (`dl-${String(r.dl_id).padStart(4, '0')}`).includes(query)
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 60px;">
            <div class="empty-icon" style="font-size: 48px; margin-bottom: 12px;">📭</div>
            <div style="color: var(--text-muted);">No ${filter === 'all' ? '' : filter + ' '}requests found</div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(req => `
      <tr class="request-row">
        <td><strong>DL-${String(req.dl_id).padStart(4, '0')}</strong></td>
        <td>
          <div style="font-weight: 600;">${req.student_name}</div>
          <div style="font-size: 12px; color: var(--text-muted);">${req.student_id} · ${req.department}</div>
        </td>
        <td>${req.event_name}</td>
        <td>${req.dl_type.toUpperCase()}-DL</td>
        <td>${req.campus_type}</td>
        <td>${req.event_date}</td>
        <td><span class="badge ${req.status}">${req.status}</span></td>
        <td>
          <div class="btn-group">
            <button class="btn btn-primary btn-sm" onclick="openVerifyModal(${req.dl_id})">🔍 Verify</button>
            ${req.status === 'pending' ? `
              <button class="btn btn-success btn-sm" onclick="updateDecision(${req.dl_id}, 'approved')" title="Approve">✅ Approve</button>
              <button class="btn btn-danger btn-sm" onclick="openModal('reject', ${req.dl_id})" title="Reject">❌ Reject</button>
              <button class="btn btn-warning btn-sm" onclick="openModal('flag', ${req.dl_id})" title="Flag">⚠️ Flag</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  }

  // ==========================================
  // VERIFICATION MODAL
  // ==========================================

  function isImageFile(filepath) {
    if (!filepath) return false;
    const ext = filepath.split('.').pop().toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
  }

  window.openVerifyModal = async function(dlId) {
    currentDLId = dlId;
    const modal = document.getElementById('verifyModal');
    modal.classList.add('active');

    document.getElementById('modalDLId').textContent = `DL-${String(dlId).padStart(4, '0')}`;
    document.getElementById('modalBody').innerHTML = '<div class="spinner"></div>';
    document.getElementById('modalFooter').innerHTML = '';

    try {
      // Fetch request details with timeout
      const reqController = new AbortController();
      const reqTimeout = setTimeout(() => reqController.abort(), 10000);
      const reqRes = await fetch(`/api/dl/admin/request/${dlId}`, { signal: reqController.signal });
      clearTimeout(reqTimeout);
      
      if (!reqRes.ok) throw new Error(`Failed to fetch request: ${reqRes.status}`);
      const reqData = await reqRes.json();
      const req = reqData.request;

      // Fetch verification data with timeout
      const verifyController = new AbortController();
      const verifyTimeout = setTimeout(() => verifyController.abort(), 15000);
      const verifyRes = await fetch(`/api/dl/admin/verify/${dlId}`, { 
        method: 'PUT', 
        signal: verifyController.signal 
      });
      clearTimeout(verifyTimeout);
      
      if (!verifyRes.ok) throw new Error(`Verification failed: ${verifyRes.status}`);
      const verifyData = await verifyRes.json();
      const { results, score, flags, summary, prd, totalChecks, failedChecks } = verifyData.verification;

      // ── HELPERS ──
      const prdData = prd || {};
      const checkIcon = (val) => val ? '✅' : '❌';
      const checkClass = (val) => val ? 'pass' : 'fail';
      const safeResults = results || [];

      // ── BUILD FULL DETAILED HTML ──
      let detailsHTML = '';

      // ── 1. STUDENT & EVENT INFO CARD ──
      detailsHTML += `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px;">
            <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Student</div>
            <div style="font-size:14px; font-weight:700; color:#1e293b;">${req.student_name || req.student_id}</div>
            <div style="font-size:12px; color:#64748b; margin-top:2px;">${req.student_id} · ${req.department || 'N/A'}</div>
          </div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px;">
            <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Event</div>
            <div style="font-size:14px; font-weight:700; color:#1e293b;">${req.event_name}</div>
            <div style="font-size:12px; color:#64748b; margin-top:2px;">${req.event_date} · ${req.dl_type?.toUpperCase()}-DL · ${req.campus_type}</div>
            ${req.event_id ? `<div style="font-size:11px; color:#94a3b8; margin-top:4px;">Event ID: ${req.event_id}</div>` : ''}
          </div>
        </div>
      `;

      // ── 2. PRD SUMMARY CARD ──
      const scoreColor = score === 0 ? '#16a34a' : score <= 1 ? '#d97706' : '#dc2626';
      const scoreBg = score === 0 ? '#dcfce7' : score <= 1 ? '#fef3c7' : '#fee2e2';
      const scoreBorder = score === 0 ? '#bbf7d0' : score <= 1 ? '#fde68a' : '#fecaca';

      detailsHTML += `
        <div class="prd-summary-card" style="border-left: 5px solid ${scoreColor}; margin-bottom:20px;">
          <div class="prd-summary-title">
            <span class="material-icons-round" style="font-size:20px; color:${scoreColor};">fact_check</span>
            <h4>Verification Summary</h4>
            <span class="prd-badge" style="background:${scoreBg}; color:${scoreColor}; border:1px solid ${scoreBorder};">${summary || `${score} failed`}</span>
          </div>
          <div class="prd-summary-grid">
            <div class="prd-check-item">
              <span class="prd-check-label">UID Match</span>
              <span class="prd-check-value ${checkClass(prdData.uidMatch)}">${checkIcon(prdData.uidMatch)} ${prdData.uidMatch ? 'Yes' : 'No'}</span>
            </div>
            <div class="prd-check-item">
              <span class="prd-check-label">Attendance Found</span>
              <span class="prd-check-value ${checkClass(prdData.uidMatch)}">${checkIcon(prdData.uidMatch)} ${prdData.uidMatch ? 'Found' : 'Not Found'}</span>
            </div>
            <div class="prd-check-item">
              <span class="prd-check-label">Attendance Location</span>
              <span class="prd-check-value ${checkClass(prdData.attendanceLocationMatch)}">${checkIcon(prdData.attendanceLocationMatch)} ${prdData.attendanceLocationMatch ? 'Match' : 'No Match'}</span>
            </div>
            <div class="prd-check-item">
              <span class="prd-check-label">DL Location</span>
              <span class="prd-check-value ${checkClass(prdData.dlLocationMatch)}">${checkIcon(prdData.dlLocationMatch)} ${prdData.dlLocationMatch ? 'Match' : 'No Match'}</span>
            </div>
            <div class="prd-distance-item">
              <span class="prd-check-label">Distance</span>
              <span class="prd-check-value neutral">${prdData.distance || 'N/A'}</span>
            </div>
            <div class="prd-distance-item" style="grid-column: 1 / -1; margin-top: 8px;">
              <span class="prd-check-label">Score</span>
              <span class="prd-check-value ${score === 0 ? 'pass' : score === 1 ? 'warn' : 'fail'}">${score} of ${totalChecks || safeResults.length} checks failed</span>
            </div>
          </div>
        </div>
      `;

      // ── 3. ALL INDIVIDUAL CHECK RESULTS ──
      if (safeResults.length > 0) {
        detailsHTML += `
          <div style="margin-bottom:16px;">
            <h4 style="font-size:13px; font-weight:800; color:#1e293b; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:14px; display:flex; align-items:center; gap:8px;">
              <span class="material-icons-round" style="font-size:18px; color:#475569;">checklist</span>
              Detailed Check Results
            </h4>
        `;

        safeResults.forEach((check, i) => {
          const passed = check.passed;
          const statusIcon = passed ? '✅' : '❌';
          const borderColor = passed ? '#16a34a' : '#dc2626';
          const bgColor = passed ? '#f0fdf4' : '#fef2f2';
          const statusText = passed ? 'PASSED' : 'FAILED';
          const statusBg = passed ? '#dcfce7' : '#fee2e2';
          const statusFg = passed ? '#15803d' : '#b91c1c';

          detailsHTML += `
            <div style="background:${bgColor}; border:1px solid ${passed ? '#bbf7d0' : '#fecaca'}; border-left:4px solid ${borderColor}; border-radius:10px; padding:14px 16px; margin-bottom:10px;">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
                <span style="font-size:13px; font-weight:700; color:#1e293b;">${statusIcon} ${check.name}</span>
                <span style="font-size:10px; font-weight:700; padding:3px 10px; border-radius:999px; background:${statusBg}; color:${statusFg}; text-transform:uppercase; letter-spacing:0.5px;">${statusText}</span>
              </div>
              <div style="font-size:12px; color:#475569; line-height:1.6; word-break:break-word;">${check.reason || 'No details available'}</div>
            </div>
          `;
        });

        detailsHTML += `</div>`;
      }

      // ── 4. FLAGS (if any) ──
      const safeFlags = flags || [];
      if (safeFlags.length > 0) {
        detailsHTML += `
          <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:14px 16px; margin-bottom:16px;">
            <div style="font-size:12px; font-weight:700; color:#92400e; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
              <span class="material-icons-round" style="font-size:16px;">flag</span>
              Flags (${safeFlags.length})
            </div>
            ${safeFlags.map(f => `<div style="font-size:12px; color:#78350f; padding:3px 0;">⚠️ ${f}</div>`).join('')}
          </div>
        `;
      }

      document.getElementById('modalBody').innerHTML = detailsHTML;

      // Footer actions
      if (req.status === 'pending') {
        const failedReasons = safeResults.filter(r => !r.passed).map(r => r.reason);
        document.getElementById('modalFooter').innerHTML = `
          <button class="btn btn-success btn-sm" onclick="updateDecision(${dlId}, 'approved')">✅ Approve</button>
          <button class="btn btn-warning btn-sm" onclick="openModal('flag', ${dlId})">⚠️ Flag</button>
          <button class="btn btn-danger btn-sm" onclick="openModal('reject', ${dlId})">❌ Reject</button>
        `;
      } else {
        document.getElementById('modalFooter').innerHTML = `
          <span class="badge ${req.status}" style="font-size: 14px; padding: 8px 16px;">Status: ${req.status.toUpperCase()}</span>
        `;
      }
    } catch (err) {
      console.error("❌ [VERIFY] Modal error:", err);
      const errMsg = err.name === 'AbortError' ? 'Request timed out' : (err.message || 'Unknown error');
      document.getElementById('modalBody').innerHTML = `
        <div style="text-align:center; padding:24px;">
          <div style="font-size:32px; margin-bottom:12px;">⚠️</div>
          <p style="color: var(--danger); font-weight:600;">Failed to load verification data</p>
          <p style="color:#718096; font-size:12px; margin-top:8px;">${errMsg}</p>
        </div>
      `;
    }
  };

  // Helper for existing local references
  function closeModal() {
    window.closeModal();
  }

  function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
});

