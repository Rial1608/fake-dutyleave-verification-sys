// Login page logic
document.addEventListener('DOMContentLoaded', () => {
  // Check if already logged in
  fetch('/api/dl/auth/session')
    .then(r => r.json())
    .then(data => {
      if (data.loggedIn) {
        redirectByRole(data.user.role);
      }
    });

  // Role toggle
  const roleToggle = document.getElementById('roleToggle');
  const toggleBtns = roleToggle.querySelectorAll('.toggle-btn');
  let selectedRole = 'student';

  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedRole = btn.dataset.role;

      const idInput = document.getElementById('studentId');
      if (selectedRole === 'admin') {
        idInput.placeholder = 'Enter Admin ID (e.g. ADMIN01)';
      } else {
        idInput.placeholder = 'Enter Student ID (e.g. STU001)';
      }
    });
  });

  // Login form
  const form = document.getElementById('loginForm');
  const errorDiv = document.getElementById('loginError');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.style.display = 'none';

    const student_id = document.getElementById('studentId').value.trim();
    const password = document.getElementById('password').value;

    if (!student_id || !password) {
      showError('Please fill in all fields');
      return;
    }

    try {
      const res = await fetch('/api/dl/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id, password })
      });

      const data = await res.json();

      if (data.success) {
        redirectByRole(data.user.role);
      } else {
        showError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      showError('Server error. Please try again.');
    }
  });

  function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
  }

  function redirectByRole(role) {
    if (role === 'admin') {
      window.location.href = '/admin-dashboard';
    } else {
      window.location.href = '/student-dashboard';
    }
  }
});
