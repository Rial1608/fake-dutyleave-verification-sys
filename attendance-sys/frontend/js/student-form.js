/* ════════════════════════════════════════════════════════════════
   STUDENT FORM - GPS & ATTENDANCE SUBMISSION
   ════════════════════════════════════════════════════════════════ */

class StudentForm {
  constructor() {
    this.formId = this.getFormIdFromURL();
    this.formData = null;
    this.locationData = null;
    this.init();
  }

  getFormIdFromURL() {
    const pathParts = window.location.pathname.split('/');
    return pathParts[pathParts.length - 1];
  }

  async init() {
    try {
      await this.loadForm();
      this.initializeEventListeners();
      this.requestGPSLocation();
    } catch (error) {
      this.showStatusMessage('Failed to load form', 'error');
      console.error('Init error:', error);
    }
  }

  async loadForm() {
    try {
      const response = await fetch(`/api/forms/${this.formId}`);
      if (!response.ok) {
        throw new Error('Form not found');
      }

      this.formData = await response.json();
      this.renderForm();
    } catch (error) {
      throw error;
    }
  }

  renderForm() {
    const form = this.formData.form;

    // Update title
    document.getElementById('form-title').textContent = form.eventName;
    document.getElementById('form-description').textContent = form.description || 'Please fill in your details to mark attendance';

    // Render fields
    const container = document.getElementById('form-fields-container');
    container.innerHTML = '';

    form.fields.forEach(field => {
      const fieldElement = this.createFieldElement(field);
      container.appendChild(fieldElement);
    });
  }

  createFieldElement(field) {
    const div = document.createElement('div');
    div.className = 'form-field';

    const label = document.createElement('label');
    label.textContent = field.label + (field.required ? ' *' : '');

    let input;

    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
        input = document.createElement('input');
        input.type = field.type;
        input.placeholder = `Enter ${field.label.toLowerCase()}`;
        break;

      case 'number':
        input = document.createElement('input');
        input.type = 'number';
        input.placeholder = `Enter ${field.label.toLowerCase()}`;
        break;

      case 'dropdown':
        input = document.createElement('select');
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = `Select ${field.label}`;
        input.appendChild(placeholder);

        field.options.forEach(option => {
          const opt = document.createElement('option');
          opt.value = option;
          opt.textContent = option;
          input.appendChild(opt);
        });
        break;

      default:
        input = document.createElement('input');
        input.type = 'text';
    }

    input.setAttribute('data-field-id', field.id);
    if (field.required) {
      input.required = true;
    }

    div.appendChild(label);
    div.appendChild(input);

    return div;
  }

  requestGPSLocation() {
    const indicator = document.getElementById('location-indicator');
    indicator.classList.remove('active');
    indicator.textContent = '⏳';

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        position => this.handleLocationSuccess(position),
        error => this.handleLocationError(error),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      this.showStatusMessage('Geolocation not supported in your browser', 'error');
    }
  }

  handleLocationSuccess(position) {
    this.locationData = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy
    };

    // Update location display
    document.getElementById('location-lat-display').textContent = `Lat: ${this.locationData.latitude.toFixed(6)}`;
    document.getElementById('location-lng-display').textContent = `Lng: ${this.locationData.longitude.toFixed(6)}`;
    document.getElementById('location-accuracy-display').textContent = `Accuracy: ${Math.round(this.locationData.accuracy)}m`;

    // Update indicator
    const indicator = document.getElementById('location-indicator');
    indicator.classList.add('active');
    indicator.textContent = '✅';

    this.showStatusMessage('✅ Location captured successfully', 'success');
  }

  handleLocationError(error) {
    let message = 'Failed to get location';

    switch (error.code) {
      case error.PERMISSION_DENIED:
        message = 'Location permission denied. Attendance submission requires GPS location.';
        break;
      case error.POSITION_UNAVAILABLE:
        message = 'Location information unavailable';
        break;
      case error.TIMEOUT:
        message = 'Location request timed out';
        break;
    }

    this.showStatusMessage(message, 'error');
    console.error('Location error:', error);
  }

  initializeEventListeners() {
    const form = document.getElementById('attendance-form');
    form.addEventListener('submit', e => this.handleSubmit(e));

    // Retry GPS button (if needed)
    const locationStatus = document.querySelector('.location-status');
    if (locationStatus) {
      locationStatus.addEventListener('click', () => {
        if (!this.locationData) {
          this.requestGPSLocation();
        }
      });
    }
  }

  async handleSubmit(e) {
    e.preventDefault();

    // Check location
    if (!this.locationData) {
      this.showStatusMessage('❌ Please enable location access to submit attendance', 'error');
      return;
    }

    // Collect form data
    const responses = {};
    document.querySelectorAll('.form-field input, .form-field select').forEach(field => {
      const fieldId = field.getAttribute('data-field-id');
      if (fieldId) {
        responses[fieldId] = field.value;
      }
    });

    // Validate required fields
    const missingFields = [];
    document.querySelectorAll('.form-field input[required], .form-field select[required]').forEach(field => {
      if (!field.value.trim()) {
        const label = field.previousElementSibling?.textContent || 'Field';
        missingFields.push(label);
      }
    });

    if (missingFields.length > 0) {
      this.showStatusMessage(`❌ Please fill in: ${missingFields.join(', ')}`, 'error');
      return;
    }

    // Submit
    await this.submitAttendance(responses);
  }

  async submitAttendance(responses) {
    try {
      this.showLoading(true);

      // ── SMART UID EXTRACTION ──
      // Find the field whose label matches UID/University ID/Roll Number/Student ID
      // instead of blindly using the first field (which may be "Student Name")
      const formFields = this.formData.form.fields || [];
      let uidValue = null;

      // Strategy 1: Find field whose label contains uid/university/roll/student id
      for (const field of formFields) {
        const label = (field.label || '').toLowerCase();
        if (label.includes('uid') || label.includes('university id') || 
            label.includes('roll') || label.includes('student id') ||
            label.includes('enrollment')) {
          uidValue = responses[field.id];
          console.log(`📋 [UID] Found UID field by label "${field.label}": ${uidValue}`);
          break;
        }
      }

      // Strategy 2: If no UID-labeled field found, try second field (common: Name=1st, UID=2nd)
      if (!uidValue && formFields.length >= 2) {
        uidValue = responses[formFields[1].id];
        console.log(`📋 [UID] Using second field "${formFields[1].label}" as UID fallback: ${uidValue}`);
      }

      // Strategy 3: Last resort — use first field
      if (!uidValue && formFields.length >= 1) {
        uidValue = responses[formFields[0].id];
        console.log(`📋 [UID] Using first field "${formFields[0].label}" as UID last-resort: ${uidValue}`);
      }

      const payload = {
        formId: this.formId,
        uid: (uidValue || '').trim().toLowerCase(),
        responses: responses,
        location: this.locationData
      };

      const response = await fetch('/api/attendance/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Submission failed');
      }

      this.showSuccess(result.attendance);
    } catch (error) {
      this.showStatusMessage(`❌ ${error.message}`, 'error');
      console.error('Submission error:', error);
    } finally {
      this.showLoading(false);
    }
  }

  showStatusMessage(message, type) {
    const statusDiv = document.getElementById('status-message');
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type}`;
    statusDiv.style.display = 'block';
  }

  showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    const btn = document.getElementById('submit-form-btn');

    if (show) {
      overlay.style.display = 'flex';
      btn.disabled = true;
      btn.classList.add('loading');
    } else {
      overlay.style.display = 'none';
      btn.disabled = false;
      btn.classList.remove('loading');
    }
  }

  showSuccess(attendance) {
    // Hide form
    document.getElementById('attendance-form').style.display = 'none';
    const locStatus = document.getElementById('location-status');
    if (locStatus) locStatus.style.display = 'none';

    // Show success message
    const successDiv = document.getElementById('success-message');
    successDiv.style.display = 'block';
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  new StudentForm();
});
