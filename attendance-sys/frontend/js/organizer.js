/* ════════════════════════════════════════════════════════════════
   ORGANIZER PANEL - FORM BUILDER & MANAGEMENT
   Premium SaaS-Style Interface with Smooth Micro-Interactions
   ════════════════════════════════════════════════════════════════ */

class OrganizerPanel {
  constructor() {
    this.organizerId = localStorage.getItem('organizerId') || 'org_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('organizerId', this.organizerId);
    this.currentForm = null;
    this.forms = [];
    this.currentFields = [];
    this.isSubmitting = false;
    this.init();
  }

  async init() {
    this.setupAllEventListeners();
    await this.loadDashboard();
    this.setupPageNavigation();
    this.initializeButtonAnimations();
  }

  setupAllEventListeners() {
    // Create Form button
    const createFormBtn = document.getElementById('create-form-btn');
    if (createFormBtn) {
      createFormBtn.addEventListener('click', () => {
        this.addButtonClickAnimation(createFormBtn);
        this.showPage('create-form');
      });
    }

    // Save Form
    const saveFormBtn = document.getElementById('save-form-btn');
    if (saveFormBtn) {
      saveFormBtn.addEventListener('click', e => {
        e.preventDefault();
        this.addButtonClickAnimation(saveFormBtn);
        this.saveForm();
      });
    }

    // Cancel Form
    const cancelBtn = document.getElementById('cancel-form-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.showPage('dashboard');
      });
    }

    // Add Field Button
    const addFieldBtn = document.getElementById('add-field-btn');
    if (addFieldBtn) {
      addFieldBtn.addEventListener('click', () => {
        this.addButtonClickAnimation(addFieldBtn);
        this.addField();
      });
    }

    // Delete Field (delegated)
    document.addEventListener('click', e => {
      if (e.target.classList.contains('btn-delete-field')) {
        const fieldItem = e.target.closest('.field-item');
        this.animateFieldRemoval(fieldItem);
      }
    });

    // Modal close
    const btnClose = document.querySelector('.btn-close');
    if (btnClose) {
      btnClose.addEventListener('click', () => {
        this.closeModal();
      });
    }

    // Close modal on backdrop click
    const modal = document.getElementById('form-details-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal();
        }
      });
    }

    // Tab switching with smooth transitions
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = btn.getAttribute('data-tab');
        this.switchTab(tabName, e);
      });
    });

    // Copy link with feedback
    const copyLinkBtn = document.getElementById('copy-link-btn');
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', () => {
        this.copyToClipboard();
      });
    }

    // Download QR button
    const downloadQrBtn = document.getElementById('download-qr-btn');
    if (downloadQrBtn) {
      downloadQrBtn.addEventListener('click', () => {
        this.downloadQRCode();
      });
    }

    // Search forms with debouncing
    const searchForms = document.getElementById('search-forms');
    if (searchForms) {
      let searchTimeout;
      searchForms.addEventListener('input', e => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.filterForms(e.target.value);
        }, 300);
      });
    }
  }

  setupPageNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', e => {
        e.preventDefault();
        const page = item.getAttribute('data-page');
        this.showPage(page);
      });
    });
  }

  showPage(pageName) {
    // Smooth page transition
    const allPages = document.querySelectorAll('.page');
    allPages.forEach(page => {
      page.classList.remove('active');
    });
    
    const page = document.getElementById(`${pageName}-page`);
    if (page) {
      page.classList.add('active');
      const titleEl = document.getElementById('page-title');
      const subtitleEl = document.getElementById('page-subtitle');
      if (titleEl) {
        titleEl.textContent = this.getPageTitle(pageName);
      }
      if (subtitleEl) {
        subtitleEl.textContent = this.getPageSubtitle(pageName);
      }
    }

    // Update nav with active state
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('data-page') === pageName) {
        item.classList.add('active');
      }
    });

    // Trigger page-specific actions
    if (pageName === 'forms') {
      this.loadAllForms();
    } else if (pageName === 'create-form') {
      this.resetFormBuilder();
    } else if (pageName === 'dashboard') {
      this.loadDashboard();
    }
  }

  getPageTitle(pageName) {
    const titles = {
      'dashboard': 'Dashboard',
      'create-form': 'Create New Attendance Form',
      'forms': 'My Forms',
      'analytics': 'Analytics & Reports'
    };
    return titles[pageName] || 'Attendance Hub';
  }

  getPageSubtitle(pageName) {
    const subtitles = {
      'dashboard': 'Manage your attendance forms',
      'create-form': 'Set up custom fields and location requirements',
      'forms': 'View and manage all your created forms',
      'analytics': 'View detailed attendance analytics'
    };
    return subtitles[pageName] || '';
  }

  initializeButtonAnimations() {
    // Add hover and click animations to all buttons
    document.querySelectorAll('.btn-primary, .btn-secondary').forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'translateY(-2px)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translateY(0)';
      });
    });
  }

  addButtonClickAnimation(button) {
    button.style.transform = 'scale(0.98)';
    setTimeout(() => {
      button.style.transform = '';
    }, 100);
  }

  animateFieldRemoval(fieldItem) {
    fieldItem.style.opacity = '0';
    fieldItem.style.transform = 'translateX(-20px)';
    fieldItem.style.transition = 'all 0.3s ease-out';
    setTimeout(() => {
      fieldItem.remove();
    }, 300);
  }

  addField() {
    const fieldsList = document.getElementById('fields-list');
    
    const fieldItem = document.createElement('div');
    fieldItem.className = 'field-item';
    fieldItem.style.animation = 'slideIn 0.3s ease-out';
    fieldItem.innerHTML = `
      <input type="text" placeholder="Field Label" class="field-label" >
      <select class="field-type">
        <option value="text">Text</option>
        <option value="number">Number</option>
        <option value="email">Email</option>
        <option value="tel">Phone</option>
        <option value="dropdown">Dropdown</option>
      </select>
      <button type="button" class="btn-delete-field">🗑️</button>
    `;
    
    fieldsList.appendChild(fieldItem);
    
    // Focus on new field for better UX
    const newInput = fieldItem.querySelector('.field-label');
    newInput.focus();
  }

  async saveForm() {
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    const saveBtn = document.getElementById('save-form-btn');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<span class="icon">⏳</span> Creating...';
    saveBtn.disabled = true;

    try {
      // Get form data with validation
      const eventName = document.getElementById('event-name').value.trim();
      const eventDateTime = document.getElementById('event-datetime').value;
      const eventDescription = document.getElementById('event-description').value;
      const locationAddress = document.getElementById('location-address').value;
      const locationLat = parseFloat(document.getElementById('location-lat').value);
      const locationLng = parseFloat(document.getElementById('location-lng').value);
      const maxDistance = parseInt(document.getElementById('max-distance').value);

      // Validation with feedback
      if (!eventName) {
        this.showValidationError('Event name is required');
        return;
      }
      if (!eventDateTime) {
        this.showValidationError('Event date and time is required');
        return;
      }
      if (isNaN(locationLat) || isNaN(locationLng)) {
        this.showValidationError('Valid location coordinates (latitude & longitude) are required');
        return;
      }

      // Collect fields
      const fields = [];
      document.querySelectorAll('.field-item').forEach((item, index) => {
        const label = item.querySelector('.field-label').value.trim();
        const type = item.querySelector('.field-type').value;

        if (label) {
          fields.push({
            id: `field_${index}_${Date.now()}`,
            label,
            type,
            required: true,
            options: type === 'dropdown' ? [] : undefined
          });
        }
      });

      if (fields.length === 0) {
        this.showValidationError('Please add at least one field');
        return;
      }

      // Submit to API
      const response = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName,
          eventLocation: {
            latitude: locationLat,
            longitude: locationLng,
            address: locationAddress
          },
          eventDateTime,
          description: eventDescription,
          fields,
          organizerId: this.organizerId,
          organizerName: 'Organizer',
          maxLocationDistance: maxDistance
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create form');
      }

      // Show success with smooth transition
      this.showFormCreatedModal(result.form);
      this.showSuccessMessage('Form created successfully!');
      this.resetFormBuilder();
      await this.loadAllForms();
    } catch (error) {
      this.showValidationError(`Error: ${error.message}`);
      console.error('Save form error:', error);
    } finally {
      this.isSubmitting = false;
      saveBtn.innerHTML = originalText;
      saveBtn.disabled = false;
    }
  }

  showValidationError(message) {
    // Create temporary error message
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #EF4444;
      color: white;
      padding: 16px 24px;
      border-radius: 10px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.15);
      z-index: 9999;
      animation: slideInRight 0.3s ease-out;
      max-width: 400px;
      font-size: 14px;
      font-weight: 500;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);

    setTimeout(() => {
      errorDiv.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => {
        errorDiv.remove();
      }, 300);
    }, 4000);
  }

  showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10B981;
      color: white;
      padding: 16px 24px;
      border-radius: 10px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.15);
      z-index: 9999;
      animation: slideInRight 0.3s ease-out;
      max-width: 400px;
      font-size: 14px;
      font-weight: 500;
    `;
    successDiv.textContent = message;
    document.body.appendChild(successDiv);

    setTimeout(() => {
      successDiv.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => {
        successDiv.remove();
      }, 300);
    }, 3000);
  }

  resetFormBuilder() {
    document.getElementById('event-name').value = '';
    document.getElementById('event-datetime').value = '';
    document.getElementById('event-description').value = '';
    document.getElementById('location-address').value = '';
    document.getElementById('location-lat').value = '';
    document.getElementById('location-lng').value = '';

    // Reset fields with smooth animation
    const fieldsList = document.getElementById('fields-list');
    fieldsList.innerHTML = `
      <div class="field-item">
        <input type="text" placeholder="Field Label" class="field-label" value="University ID">
        <select class="field-type">
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="email">Email</option>
          <option value="tel">Phone</option>
          <option value="dropdown">Dropdown</option>
        </select>
        <button type="button" class="btn-delete-field">🗑️</button>
      </div>
      <div class="field-item">
        <input type="text" placeholder="Field Label" class="field-label" value="Student Name">
        <select class="field-type">
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="email">Email</option>
          <option value="tel">Phone</option>
          <option value="dropdown">Dropdown</option>
        </select>
        <button type="button" class="btn-delete-field">🗑️</button>
      </div>
    `;
  }

  showFormCreatedModal(form) {
    this.currentForm = form;
    const modal = document.getElementById('form-details-modal');
    
    document.getElementById('modal-form-title').textContent = form.eventName;
    
    // Set form link
    const formLink = form.formLink || `${window.location.origin}/form/${form.formId}`;
    document.getElementById('form-link').value = formLink;

    // Set QR code image
    if (form.qrCode) {
      document.getElementById('qr-image').src = form.qrCode;
      document.getElementById('qr-image').style.display = 'block';
    } else {
      // Generate a QR code link using a public API as fallback
      document.getElementById('qr-image').src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(formLink)}`;
      document.getElementById('qr-image').style.display = 'block';
    }

    // Reset to details tab
    this.switchTab('details');

    modal.classList.add('active');
    modal.style.animation = 'fadeIn 0.3s ease-out';
  }

  closeModal() {
    const modal = document.getElementById('form-details-modal');
    modal.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => {
      modal.classList.remove('active');
    }, 300);
  }

  switchTab(tabName, event) {
    // Smooth tab transition
    const allTabs = document.querySelectorAll('.tab-content');
    allTabs.forEach(tab => tab.classList.remove('active'));
    
    const allBtns = document.querySelectorAll('.tab-btn');
    allBtns.forEach(btn => btn.classList.remove('active'));

    const tab = document.getElementById(`${tabName}-tab`);
    if (tab) {
      tab.classList.add('active');
      tab.style.animation = 'fadeIn 0.3s ease-out';
    }

    // Find and activate the button
    const btn = document.querySelector(`[data-tab="${tabName}"]`);
    if (btn) btn.classList.add('active');

    if (tabName === 'responses' && this.currentForm) {
      this.loadResponses();
    }
  }

  async loadResponses() {
    try {
      const responsesList = document.getElementById('responses-list');
      responsesList.innerHTML = '<p style="text-align: center; color: var(--text-lighter);">Loading...</p>';

      const response = await fetch(`/api/forms/${this.currentForm.formId}/responses`);
      const data = await response.json();

      if (!data.responses || data.responses.length === 0) {
        responsesList.innerHTML = '<p class="no-data">No responses yet</p>';
        return;
      }

      const html = data.responses.map((r, index) => {
        const statusColor = r.status === 'VALID' ? '#10B981' : '#F59E0B';
        const statusBg = r.status === 'VALID' ? '#ECFDF5' : '#FFFBEB';
        return `
          <div class="form-item-card" style="animation: fadeIn 0.3s ease-out ${index * 0.05}s backwards;">
            <div class="form-item-header">
              <div>
                <p class="form-item-title">UID: ${r.uid}</p>
                <p class="form-item-meta">${new Date(r.submittedAt).toLocaleString()}</p>
              </div>
              <span class="form-item-badge" style="background: ${statusBg}; color: ${statusColor};">${r.status}</span>
            </div>
            <div style="font-size: 0.9rem; color: var(--text-light);">
              Distance: ${r.distance}m | Location: ${r.location.latitude.toFixed(4)}, ${r.location.longitude.toFixed(4)}
            </div>
          </div>
        `;
      }).join('');

      responsesList.innerHTML = html;
    } catch (error) {
      console.error('Load responses error:', error);
      document.getElementById('responses-list').innerHTML = '<p class="no-data">Error loading responses</p>';
    }
  }

  copyToClipboard() {
    const link = document.getElementById('form-link');
    const copyBtn = document.getElementById('copy-link-btn');
    const originalText = copyBtn.textContent;

    // Modern clipboard API
    navigator.clipboard.writeText(link.value).then(() => {
      copyBtn.textContent = '✓ Copied!';
      copyBtn.style.color = 'var(--primary)';
      setTimeout(() => {
        copyBtn.textContent = originalText;
        copyBtn.style.color = '';
      }, 2000);
    }).catch(() => {
      // Fallback
      link.select();
      document.execCommand('copy');
      copyBtn.textContent = '✓ Copied!';
      copyBtn.style.color = 'var(--primary)';
      setTimeout(() => {
        copyBtn.textContent = originalText;
        copyBtn.style.color = '';
      }, 2000);
    });
  }

  downloadQRCode() {
    const qrImage = document.getElementById('qr-image');
    if (qrImage && qrImage.src) {
      const link = document.createElement('a');
      link.download = `qr-${this.currentForm?.eventName || 'form'}.png`;
      link.href = qrImage.src;
      link.click();
    }
  }

  // Load ALL forms (not filtered by organizer) — ensures forms persist across sessions
  async loadAllForms() {
    try {
      const response = await fetch('/api/forms');
      if (!response.ok) throw new Error('Failed to fetch forms');
      const data = await response.json();
      this.forms = data.forms || [];
      this.updateDashboard();
      this.renderFormsList();
    } catch (error) {
      console.error('Load forms error:', error);
      this.forms = [];
      this.updateDashboard();
    }
  }

  updateDashboard() {
    // Update stats with smooth number animation
    const activeForms = document.getElementById('active-forms-count');
    const totalResponses = document.getElementById('total-responses-count');
    const verifiedEntries = document.getElementById('verified-entries-count');

    if (activeForms) {
      this.animateNumber(activeForms, this.forms.length);
    }
    
    if (totalResponses) {
      const total = this.forms.reduce((sum, f) => sum + (f.attendanceCount || 0), 0);
      this.animateNumber(totalResponses, total);
    }

    if (verifiedEntries) {
      // Count total responses as verified (GPS auto-verified)
      const verified = this.forms.reduce((sum, f) => sum + (f.attendanceCount || 0), 0);
      this.animateNumber(verifiedEntries, verified);
    }

    // Recent forms on dashboard
    const recentList = document.getElementById('recent-forms-list');
    if (this.forms.length === 0) {
      recentList.innerHTML = '<p class="no-data">No forms created yet. Create your first form!</p>';
      return;
    }

    const html = this.forms.slice(0, 6).map((form, index) => `
      <div class="form-card" style="animation: slideUp 0.4s ease-out ${index * 0.1}s backwards;" onclick="window.organizerPanel.viewForm('${form.formId}')">
        <div class="form-card-title">${form.eventName || 'Untitled Form'}</div>
        <div class="form-card-meta">
          ${form.attendanceCount || 0} responses • ${form.fieldCount || 0} fields
        </div>
      </div>
    `).join('');

    recentList.innerHTML = html;
  }

  animateNumber(element, targetNumber) {
    const currentNumber = parseInt(element.textContent) || 0;
    if (currentNumber === targetNumber) return;
    
    const diff = targetNumber - currentNumber;
    const increment = Math.ceil(Math.abs(diff) / 10) * Math.sign(diff);
    let current = currentNumber;

    const interval = setInterval(() => {
      current += increment;
      if ((increment > 0 && current >= targetNumber) || (increment < 0 && current <= targetNumber)) {
        current = targetNumber;
        clearInterval(interval);
      }
      element.textContent = current;
    }, 30);
  }

  async loadDashboard() {
    await this.loadAllForms();
  }

  renderFormsList() {
    const grid = document.getElementById('forms-grid');
    if (!grid) return;

    if (this.forms.length === 0) {
      grid.innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
          <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
          <p class="no-data" style="font-size: 16px; margin-bottom: 16px;">No forms created yet</p>
          <button class="btn-primary" onclick="window.organizerPanel.showPage('create-form')">
            <span class="icon">➕</span> Create Your First Form
          </button>
        </div>
      `;
      return;
    }

    const html = this.forms.map((form, index) => {
      const eventName = form.eventName || 'Untitled Form';
      const attendanceCount = form.attendanceCount || 0;
      const fieldCount = form.fieldCount || 0;
      const formId = form.formId;
      const dateStr = form.eventDateTime ? new Date(form.eventDateTime).toLocaleDateString() : 'No date';

      return `
        <div class="form-item-card" style="animation: slideUp 0.4s ease-out ${index * 0.05}s backwards;">
          <div class="form-item-header">
            <div>
              <p class="form-item-title">${eventName}</p>
              <p class="form-item-meta">📅 ${dateStr} • ${attendanceCount} responses • ${fieldCount} fields</p>
            </div>
            <span class="form-item-badge">Active</span>
          </div>
          <div class="form-item-actions">
            <button class="btn-secondary" onclick="event.stopPropagation(); window.organizerPanel.viewForm('${formId}')">
              👁️ View
            </button>
            <button class="btn-secondary" onclick="event.stopPropagation(); window.organizerPanel.viewResponses('${formId}')">
              📊 Responses
            </button>
            <button class="btn-secondary" onclick="event.stopPropagation(); window.organizerPanel.showQR('${formId}')">
              📱 QR Code
            </button>
            <button class="btn-secondary" onclick="event.stopPropagation(); window.organizerPanel.deleteForm('${formId}')" style="color: #EF4444;">
              🗑️ Delete
            </button>
          </div>
        </div>
      `;
    }).join('');

    grid.innerHTML = html;
  }

  filterForms(search) {
    if (!search) {
      this.renderFormsList();
      return;
    }
    
    const filtered = this.forms.filter(f => 
      (f.eventName || '').toLowerCase().includes(search.toLowerCase())
    );
    
    const grid = document.getElementById('forms-grid');
    if (filtered.length === 0) {
      grid.innerHTML = '<p class="no-data">No forms found matching your search</p>';
      return;
    }

    const html = filtered.map((form, index) => {
      const eventName = form.eventName || 'Untitled Form';
      const attendanceCount = form.attendanceCount || 0;
      const fieldCount = form.fieldCount || 0;
      const formId = form.formId;
      const dateStr = form.eventDateTime ? new Date(form.eventDateTime).toLocaleDateString() : 'No date';

      return `
        <div class="form-item-card" style="animation: slideUp 0.3s ease-out ${index * 0.05}s backwards;">
          <div class="form-item-header">
            <div>
              <p class="form-item-title">${eventName}</p>
              <p class="form-item-meta">📅 ${dateStr} • ${attendanceCount} responses • ${fieldCount} fields</p>
            </div>
            <span class="form-item-badge">Active</span>
          </div>
          <div class="form-item-actions">
            <button class="btn-secondary" onclick="event.stopPropagation(); window.organizerPanel.viewForm('${formId}')">
              👁️ View
            </button>
            <button class="btn-secondary" onclick="event.stopPropagation(); window.organizerPanel.viewResponses('${formId}')">
              📊 Responses
            </button>
            <button class="btn-secondary" onclick="event.stopPropagation(); window.organizerPanel.showQR('${formId}')">
              📱 QR Code
            </button>
            <button class="btn-secondary" onclick="event.stopPropagation(); window.organizerPanel.deleteForm('${formId}')" style="color: #EF4444;">
              🗑️ Delete
            </button>
          </div>
        </div>
      `;
    }).join('');

    grid.innerHTML = html;
  }

  viewForm(formId) {
    const form = this.forms.find(f => f.formId === formId);
    if (form) {
      this.currentForm = form;
      this.showFormCreatedModal(form);
    }
  }

  viewResponses(formId) {
    const form = this.forms.find(f => f.formId === formId);
    if (form) {
      this.currentForm = form;
      this.showFormCreatedModal(form);
      // Switch to responses tab after a brief delay for modal animation
      setTimeout(() => {
        this.switchTab('responses');
      }, 100);
    }
  }

  showQR(formId) {
    const form = this.forms.find(f => f.formId === formId);
    if (form) {
      this.currentForm = form;
      this.showFormCreatedModal(form);
      // Switch to QR tab after a brief delay for modal animation
      setTimeout(() => {
        this.switchTab('qr');
      }, 100);
    }
  }

  async deleteForm(formId) {
    if (!confirm('Are you sure you want to delete this form? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/forms/${formId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Delete failed');

      await this.loadAllForms();
      this.showSuccessMessage('Form deleted successfully');
    } catch (error) {
      this.showValidationError(`Error: ${error.message}`);
      console.error('Delete form error:', error);
    }
  }

  shareForm(formId) {
    const form = this.forms.find(f => f.formId === formId);
    if (!form) {
      this.showValidationError('Form not found');
      return;
    }

    // Show the form details modal which includes the form link and QR code
    this.currentForm = form;
    this.showFormCreatedModal(form);
  }
}

// Add keyframe animations to the document
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(-20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slideInRight {
    from {
      opacity: 0;
      transform: translateX(100px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes slideOutRight {
    from {
      opacity: 1;
      transform: translateX(0);
    }
    to {
      opacity: 0;
      transform: translateX(100px);
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes fadeOut {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }

  /* forms-grid layout for My Forms page */
  .forms-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .filters {
    margin-bottom: 20px;
  }
`;
document.head.appendChild(style);

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  window.organizerPanel = new OrganizerPanel();
});
