function isImageFile(path) {
  return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(path);
}

document.addEventListener('DOMContentLoaded', async () => {
  // Check session
  const session = await fetch('/api/dl/auth/session').then(r => r.json());
  if (!session.loggedIn || session.user.role !== 'student') {
    window.location.href = '/';
    return;
  }

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/dl/auth/logout', { method: 'POST' });
    window.location.href = '/';
  });

  let allDLs = [];

  // Filter bar
  document.getElementById('filterBar').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderDLs(btn.dataset.filter);
  });

  // Load DL status
  try {
    console.log("🔍 [STUDENT] Fetching DL status from /api/dl/student/dl-status");
    const response = await fetch('/api/dl/student/dl-status');
    
    if (!response.ok) {
      console.error(`❌ [STUDENT] API returned status ${response.status}: ${response.statusText}`);
      const errorData = await response.json().catch(() => ({}));
      console.error('   Error:', errorData);
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("✅ [STUDENT] Data loaded:", data);
    
    allDLs = data.dls;
    renderDLs('all');
  } catch (err) {
    console.error("❌ [STUDENT] Error loading DL status:", err.message);
    console.error("   Stack:", err);
    document.getElementById('dlList').innerHTML = `<p style="color: var(--danger);">❌ Failed to load data<br/><small>${err.message}</small></p>`;
  }

  function renderDLs(filter) {
    const container = document.getElementById('dlList');
    const filtered = filter === 'all' ? allDLs : allDLs.filter(dl => dl.status === filter);

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <h3>No ${filter === 'all' ? '' : filter + ' '}requests found</h3>
          <p>${filter === 'all' ? 'You haven\'t submitted any duty leave requests yet' : 'No requests with this status'}</p>
          ${filter === 'all' ? '<a href="/apply-dl" class="btn btn-primary">Apply Now</a>' : ''}
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(dl => {
      const flagReasons = dl.flag_reasons ? JSON.parse(dl.flag_reasons) : [];
      return `
        <div class="dl-card glass-card" onclick="this.querySelector('.dl-card-details').classList.toggle('show')">
          <div class="dl-card-header">
            <h4>${dl.event_name}</h4>
            <span class="badge ${dl.status}">${dl.status}</span>
          </div>
          <div class="dl-card-meta">
            <span>📅 <strong>${dl.event_date}</strong></span>
            <span>📍 <strong>${dl.event_location}</strong></span>
            <span>🏷️ <strong>${dl.dl_type.toUpperCase()}-DL</strong> · ${dl.campus_type}</span>
            <span>📎 DL-${String(dl.dl_id).padStart(4, '0')}</span>
          </div>
          <div class="dl-card-details">
            <div class="detail-grid">
              <div class="detail-item">
                <div class="detail-label">Campus Type</div>
                <div class="detail-value">${dl.campus_type} (auto-detected)</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">DL Type</div>
                <div class="detail-value">${dl.dl_type.toUpperCase()}-DL (auto-detected)</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Submitted</div>
                <div class="detail-value">${dl.submitted_at || '—'}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Documents</div>
                <div class="detail-value doc-preview-area">
                  ${dl.gps_photo ? (isImageFile(dl.gps_photo) ?
                    `<div style="margin-bottom:10px;">
                      <div style="font-size:12px;color:#718096;margin-bottom:6px;">📷 GPS Photo</div>
                      <img src="${dl.gps_photo}" alt="GPS Photo" style="max-width:100%;max-height:200px;border-radius:8px;border:1px solid #e7e8e9;object-fit:contain;display:block;">
                      <a href="${dl.gps_photo}" target="_blank" style="font-size:12px;color:#C8102E;text-decoration:none;margin-top:4px;display:inline-block;">🔗 Open Full Size</a>
                    </div>` :
                    `<div style="margin-bottom:10px;"><a href="${dl.gps_photo}" target="_blank" style="color:#C8102E;text-decoration:none;font-weight:600;">📷 View GPS Photo</a></div>`) : ''}
                  ${dl.supporting_doc ? (isImageFile(dl.supporting_doc) ?
                    `<div style="margin-bottom:10px;">
                      <div style="font-size:12px;color:#718096;margin-bottom:6px;">📄 Supporting Document</div>
                      <img src="${dl.supporting_doc}" alt="Supporting Document" style="max-width:100%;max-height:200px;border-radius:8px;border:1px solid #e7e8e9;object-fit:contain;display:block;">
                      <a href="${dl.supporting_doc}" target="_blank" style="font-size:12px;color:#C8102E;text-decoration:none;margin-top:4px;display:inline-block;">🔗 Open Full Size</a>
                    </div>` :
                    `<div style="margin-bottom:10px;"><a href="${dl.supporting_doc}" target="_blank" style="color:#C8102E;text-decoration:none;font-weight:600;">📄 View Supporting Document</a></div>`) : ''}
                  ${!dl.gps_photo && !dl.supporting_doc ? 'None uploaded' : ''}
                </div>
              </div>
            </div>
            ${flagReasons.length > 0 ? `
              <div style="margin-top: 16px; padding: 12px; background: rgba(239, 68, 68, 0.1); border-radius: var(--radius-sm); border: 1px solid rgba(239, 68, 68, 0.2);">
                <strong style="color: var(--danger); font-size: 13px;">⚠️ Flag Reasons:</strong>
                <ul style="margin-top: 8px; padding-left: 20px; font-size: 13px; color: var(--text-secondary);">
                  ${flagReasons.map(r => `<li>${r}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }
});
