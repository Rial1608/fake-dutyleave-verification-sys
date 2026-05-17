document.addEventListener('DOMContentLoaded', async () => {
  // Check session
  const session = await fetch('/api/dl/auth/session').then(r => r.json());
  if (!session.loggedIn || session.user.role !== 'student') {
    window.location.href = '/';
    return;
  }

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/dl/auth/logout', { method: 'POST' });
    window.location.href = '/';
  });

  // Load dashboard data
  try {
    const data = await fetch('/api/dl/student/dashboard').then(r => r.json());

    document.getElementById('studentName').textContent = data.student.name;
    document.getElementById('welcomeName').textContent = data.student.name.split(' ')[0];

    // Stats
    document.getElementById('statTotal').textContent = data.stats.total;
    document.getElementById('statApproved').textContent = data.stats.approved;
    document.getElementById('statPending').textContent = data.stats.pending;
    document.getElementById('statFlagged').textContent = data.stats.flagged;

    // Recent Activity
    const container = document.getElementById('recentActivity');
    if (data.recentDLs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <h3>No Duty Leave requests yet</h3>
          <p>Start by applying for your first duty leave</p>
          <a href="/apply-dl" class="btn btn-primary">Apply Now</a>
        </div>
      `;
    } else {
      container.innerHTML = data.recentDLs.map(dl => `
        <div class="dl-card glass-card">
          <div class="dl-card-header">
            <h4>${dl.event_name}</h4>
            <span class="badge ${dl.status}">${dl.status}</span>
          </div>
          <div class="dl-card-meta">
            <span>📅 <strong>${dl.event_date}</strong></span>
            <span>📍 <strong>${dl.event_location}</strong></span>
            <span>🏷️ <strong>${dl.dl_type.toUpperCase()}-DL</strong> · ${dl.campus_type}</span>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Dashboard error:', err);
  }
});
