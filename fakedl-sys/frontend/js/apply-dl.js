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
});

// ═══════════════════════════════════════════════════════
//  STATE — simple global variables
// ═══════════════════════════════════════════════════════
let currentStep = 1;
let map = null;
let marker = null;
let selected_lat = null;
let selected_lng = null;
let autocomplete = null;
let geocodeTimer = null;

// CU Campus center for auto-detection
const CU_CAMPUS = { lat: 30.7715, lng: 76.5750, radiusKm: 0.9 };

// ═══════════════════════════════════════════════════════
//  HAVERSINE DISTANCE
// ═══════════════════════════════════════════════════════
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ═══════════════════════════════════════════════════════
//  GOOGLE MAPS CALLBACK — called when API loads
// ═══════════════════════════════════════════════════════
function initMapPicker() {
  // Hide loading spinner
  const loadingEl = document.getElementById('mapLoading');
  if (loadingEl) loadingEl.style.display = 'none';

  // ── 1. CREATE MAP — always visible, always interactive ──
  const mapSection = document.getElementById('mapPickerSection');
  mapSection.style.display = 'block';

  map = new google.maps.Map(document.getElementById('googleMap'), {
    center: { lat: CU_CAMPUS.lat, lng: CU_CAMPUS.lng },
    zoom: 16,
    mapTypeId: 'hybrid',
    mapTypeControl: true,
    streetViewControl: false,
    fullscreenControl: true,
    zoomControl: true,
    gestureHandling: 'greedy',
    styles: [
      { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'on' }] }
    ]
  });

  // ── 2. CREATE DRAGGABLE MARKER ──
  marker = new google.maps.Marker({
    position: { lat: CU_CAMPUS.lat, lng: CU_CAMPUS.lng },
    map: map,
    draggable: true,
    animation: google.maps.Animation.DROP,
    title: 'Drag to select exact event location'
  });

  // Info window
  const infoWindow = new google.maps.InfoWindow({
    content: '<div style="font-family:Inter,sans-serif;font-size:12px;padding:4px"><strong>📍 Drag me</strong> or click anywhere on the map</div>'
  });
  infoWindow.open(map, marker);
  setTimeout(() => infoWindow.close(), 4000);

  // ── 3. MARKER DRAG → store location ──
  marker.addListener("dragend", function (event) {
    selected_lat = event.latLng.lat();
    selected_lng = event.latLng.lng();
    storeCoordinates(selected_lat, selected_lng);
    reverseGeocode(selected_lat, selected_lng);
  });

  // ── 4. MAP CLICK → move marker + store location ──
  map.addListener("click", function (event) {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();

    marker.setPosition({ lat, lng });
    marker.setAnimation(google.maps.Animation.BOUNCE);
    setTimeout(() => marker.setAnimation(null), 700);

    selected_lat = lat;
    selected_lng = lng;
    storeCoordinates(lat, lng);
    reverseGeocode(lat, lng);
  });

  // ── 5. AUTOCOMPLETE on the location input ──
  const input = document.getElementById('eventLocation');
  
  try {
    autocomplete = new google.maps.places.Autocomplete(input, {
      types: ['establishment', 'geocode'],
      fields: ['formatted_address', 'geometry', 'name'],
    });

    autocomplete.addListener("place_changed", function () {
      const place = autocomplete.getPlace();

      if (!place.geometry || !place.geometry.location) {
        // No geometry — try geocoding the text
        geocodeLocation(input.value);
        return;
      }

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();

      map.setCenter({ lat, lng });
      map.setZoom(16);
      marker.setPosition({ lat, lng });

      selected_lat = lat;
      selected_lng = lng;
      storeCoordinates(lat, lng);

      // Update geocode status
      const geocodeStatus = document.getElementById('geocodeStatus');
      if (geocodeStatus) {
        geocodeStatus.style.display = 'block';
        geocodeStatus.textContent = `📍 Location found: ${(place.name || place.formatted_address || '').substring(0, 60)}`;
        geocodeStatus.className = 'geocode-status found';
      }

      runAutoDetection();
    });
  } catch (e) {
    // Places Autocomplete failed - will use manual geocoding
  }

  // ── 6. TYPING → geocode and move map (debounced) ──
  input.addEventListener("input", function () {
    const query = input.value.trim();
    
    // Run text-based auto-detection
    runAutoDetection();

    // Debounced geocoding — after user stops typing for 800ms
    if (query.length >= 3) {
      clearTimeout(geocodeTimer);
      geocodeTimer = setTimeout(() => {
        geocodeLocation(query);
      }, 800);
    }
  });

  // Also geocode on change (paste, tab-out)
  input.addEventListener("change", function () {
    const query = input.value.trim();
    if (query.length >= 3) {
      clearTimeout(geocodeTimer);
      geocodeLocation(query);
    }
  });
}

// ═══════════════════════════════════════════════════════
//  STORE COORDINATES in hidden fields + update display
// ═══════════════════════════════════════════════════════
function storeCoordinates(lat, lng) {
  document.getElementById('eventLat').value = lat.toFixed(7);
  document.getElementById('eventLng').value = lng.toFixed(7);
  document.getElementById('mapSelected').value = '1';

  // Update coordinate display
  const dist = haversineDistance(lat, lng, CU_CAMPUS.lat, CU_CAMPUS.lng);
  const zone = dist <= CU_CAMPUS.radiusKm ? 'On-Campus' : 'Off-Campus';
  const coordText = document.getElementById('mapCoordText');
  if (coordText) {
    coordText.innerHTML = `<span class="map-coord-badge">📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}</span> — <strong>${zone}</strong> (${(dist * 1000).toFixed(0)}m from CU center)`;
  }

  // Update geocode status
  const geocodeStatus = document.getElementById('geocodeStatus');
  if (geocodeStatus) {
    geocodeStatus.style.display = 'block';
    geocodeStatus.textContent = '📍 Location selected from map';
    geocodeStatus.className = 'geocode-status found';
  }

  runAutoDetection();
}

// ═══════════════════════════════════════════════════════
//  GEOCODE a typed location string
// ═══════════════════════════════════════════════════════
function geocodeLocation(query) {
  if (!query || query.trim().length < 3 || !window.google) return;

  const geocoder = new google.maps.Geocoder();
  geocoder.geocode({ address: query }, (results, status) => {
    if (status === 'OK' && results[0]) {
      const lat = results[0].geometry.location.lat();
      const lng = results[0].geometry.location.lng();

      map.setCenter({ lat, lng });
      map.setZoom(16);
      marker.setPosition({ lat, lng });

      selected_lat = lat;
      selected_lng = lng;
      storeCoordinates(lat, lng);

      const geocodeStatus = document.getElementById('geocodeStatus');
      if (geocodeStatus) {
        geocodeStatus.style.display = 'block';
        geocodeStatus.textContent = `📍 Location found: ${results[0].formatted_address.substring(0, 60)}`;
        geocodeStatus.className = 'geocode-status found';
      }
    } else {
      const geocodeStatus = document.getElementById('geocodeStatus');
      if (geocodeStatus) {
        geocodeStatus.style.display = 'block';
        geocodeStatus.textContent = '⚠️ Could not find location — please select on the map below';
        geocodeStatus.className = 'geocode-status not-found';
      }
    }
  });
}

// ═══════════════════════════════════════════════════════
//  REVERSE GEOCODE — fill location input from map click
// ═══════════════════════════════════════════════════════
function reverseGeocode(lat, lng) {
  if (!window.google) return;

  const geocoder = new google.maps.Geocoder();
  geocoder.geocode({ location: { lat, lng } }, (results, status) => {
    if (status === 'OK' && results[0]) {
      document.getElementById('eventLocation').value = results[0].formatted_address;
    }
  });
}

// ═══════════════════════════════════════════════════════
//  TOGGLE MAP (collapse/expand button)
// ═══════════════════════════════════════════════════════
function toggleMapPicker() {
  const section = document.getElementById('mapPickerSection');
  const toggleBtn = document.getElementById('toggleMapBtn');

  if (section.style.display === 'none') {
    section.style.display = 'block';
    if (toggleBtn) toggleBtn.querySelector('.material-icons-round').textContent = 'expand_less';
    if (map) google.maps.event.trigger(map, 'resize');
  } else {
    section.style.display = 'none';
    if (toggleBtn) toggleBtn.querySelector('.material-icons-round').textContent = 'expand_more';
  }
}

// ═══════════════════════════════════════════════════════
//  AUTO-DETECTION
// ═══════════════════════════════════════════════════════
function runAutoDetection() {
  const eventDate = document.getElementById('eventDate').value;
  const lat = parseFloat(document.getElementById('eventLat').value);
  const lng = parseFloat(document.getElementById('eventLng').value);

  const section = document.getElementById('autoDetectedSection');
  const coordGroup = document.getElementById('coordinatorGroup');
  let detected = false;

  // DL Type detection
  if (eventDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const evDate = new Date(eventDate);
    evDate.setHours(0, 0, 0, 0);

    const dlType = evDate > today ? 'pre' : 'post';
    const dlLabel = dlType === 'pre' ? '📋 Pre-DL (Automatically Detected)' : '📄 Post-DL (Automatically Detected)';
    document.getElementById('autoDLTypeValue').textContent = dlLabel;
    detected = true;

    coordGroup.style.display = dlType === 'pre' ? 'block' : 'none';
    updateUploadSection(dlType);
  }

  // Campus Type detection
  if (!isNaN(lat) && !isNaN(lng)) {
    const dist = haversineDistance(lat, lng, CU_CAMPUS.lat, CU_CAMPUS.lng);
    const campusType = dist <= CU_CAMPUS.radiusKm ? 'in-campus' : 'out-campus';
    const campusLabel = campusType === 'in-campus'
      ? `🏫 In-Campus (${dist.toFixed(1)} km from CU)`
      : `🌐 Out-Campus (${dist.toFixed(1)} km from CU)`;
    document.getElementById('autoCampusTypeValue').textContent = campusLabel;
    detected = true;
  } else {
    const evLoc = document.getElementById('eventLocation').value || '';
    if (evLoc.toLowerCase().includes('chandigarh university') || evLoc.toLowerCase().includes(' cu')) {
      document.getElementById('autoCampusTypeValue').textContent = '🏫 In-Campus (Auto-Detected via text)';
      detected = true;
    }
  }

  section.style.display = detected ? 'block' : 'none';
}

// Update upload section visibility
function updateUploadSection(dlType) {
  const preDlUploads = document.getElementById('preDlUploads');
  const postDlUploads = document.getElementById('postDlUploads');
  
  if (dlType === 'pre') {
    preDlUploads.style.display = 'block';
    postDlUploads.style.display = 'none';
    document.getElementById('uploadDescription').textContent = 'Pre-DL requires proof of participation (poster, registration email, etc.)';
  } else {
    preDlUploads.style.display = 'none';
    postDlUploads.style.display = 'block';
    document.getElementById('uploadDescription').textContent = 'Post-DL requires GPS photo and supporting evidence';
  }
}

// ═══════════════════════════════════════════════════════
//  EVENT LISTENERS
// ═══════════════════════════════════════════════════════
document.getElementById('eventDate').addEventListener('change', runAutoDetection);

// ═══════════════════════════════════════════════════════
//  FILE UPLOAD UI
// ═══════════════════════════════════════════════════════
['gpsPhoto', 'supportingDoc', 'participationProof', 'preApprovalDoc'].forEach(id => {
  const input = document.getElementById(id);
  if (!input) return;
  const zone = input.closest('.upload-zone');

  input.addEventListener('change', () => {
    if (input.files.length > 0) {
      const textDiv = zone.querySelector('.upload-text');
      textDiv.innerHTML = `<div class="file-selected">✓ ${input.files[0].name}</div>`;
    }
  });

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('dragover');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      input.files = e.dataTransfer.files;
      input.dispatchEvent(new Event('change'));
    }
  });
});

// ═══════════════════════════════════════════════════════
//  STEP NAVIGATION
// ═══════════════════════════════════════════════════════
function nextStep(step) {
  if (currentStep === 1) {
    if (!document.getElementById('eventName').value.trim() ||
        !document.getElementById('eventDate').value) {
      showToast('Please fill in all event details', 'error');
      return;
    }

    if (!document.getElementById('eventLocation').value.trim()) {
      showToast('Please enter an event location', 'error');
      return;
    }

    // If no coordinates yet, try to geocode before moving on
    if (!selected_lat || !selected_lng) {
      geocodeLocation(document.getElementById('eventLocation').value.trim());
      showToast('Please select location on the map or wait for geocoding', 'warning');
      return;
    }
  }

  if (currentStep === 2 && step === 3) {
    const { dlType } = getDetectedValues();
    if (dlType === 'pre') {
      if (!document.getElementById('participationProof').files[0] || !document.getElementById('preApprovalDoc').files[0]) {
         showToast('Please upload both Participation Proof and the Signed ACO/HOD Application for Pre-DL', 'warning');
         return;
      }
    } else {
      if (!document.getElementById('gpsPhoto').files[0] || !document.getElementById('supportingDoc').files[0]) {
         showToast('Please upload both GPS Camera Photo and Supporting Document for Post-DL', 'warning');
         return;
      }
    }
  }

  if (step === 3) {
    updateReview();
  }

  goToStep(step);
}

function prevStep(step) {
  goToStep(step);
}

function goToStep(step) {
  document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
  document.getElementById(`step${step}`).classList.add('active');

  document.querySelectorAll('.step-dot').forEach(d => {
    const s = parseInt(d.dataset.step);
    d.classList.remove('active', 'completed');
    if (s === step) d.classList.add('active');
    else if (s < step) d.classList.add('completed');
  });

  currentStep = step;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ═══════════════════════════════════════════════════════
//  AUTO-DETECTED VALUES
// ═══════════════════════════════════════════════════════
function getDetectedValues() {
  const eventDate = document.getElementById('eventDate').value;
  const lat = parseFloat(document.getElementById('eventLat').value);
  const lng = parseFloat(document.getElementById('eventLng').value);
  const eventLocation = document.getElementById('eventLocation').value;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const evDate = new Date(eventDate);
  evDate.setHours(0, 0, 0, 0);
  const dlType = evDate > today ? 'pre' : 'post';

  let campusType = 'out-campus';
  if (!isNaN(lat) && !isNaN(lng)) {
    const dist = haversineDistance(lat, lng, CU_CAMPUS.lat, CU_CAMPUS.lng);
    campusType = dist <= CU_CAMPUS.radiusKm ? 'in-campus' : 'out-campus';
  } else if (eventLocation.toLowerCase().includes('chandigarh university') || eventLocation.toLowerCase().includes(' cu')) {
    campusType = 'in-campus';
  }

  return { dlType, campusType };
}

// ═══════════════════════════════════════════════════════
//  REVIEW
// ═══════════════════════════════════════════════════════
function filePreviewHTML(file, label) {
  if (!file) return `<span>❌ Not uploaded</span>`;
  const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file.name);
  if (isImage) {
    const url = URL.createObjectURL(file);
    return `
      <div style="display:flex;flex-direction:column;gap:6px;">
        <span style="color:var(--success);font-weight:600;">✓ ${file.name}</span>
        <img src="${url}" alt="${label}" style="max-width:100%;max-height:200px;border-radius:8px;border:1px solid var(--glass-border);object-fit:contain;margin-top:4px;">
      </div>`;
  }
  return `<span style="color:var(--success);font-weight:600;">✓ ${file.name}</span>`;
}

function updateReview() {
  const { dlType, campusType } = getDetectedValues();
  const mapSel = document.getElementById('mapSelected').value === '1';

  document.getElementById('reviewDLType').textContent = dlType === 'pre' ? '📋 Pre-DL (Auto-detected)' : '📄 Post-DL (Auto-detected)';
  document.getElementById('reviewCampus').textContent = campusType === 'in-campus'
    ? `🏫 In-Campus (Auto-detected${mapSel ? ' — Map Selected' : ''})`
    : `🌐 Out-Campus (Auto-detected${mapSel ? ' — Map Selected' : ''})`;

  const coordRow = document.getElementById('reviewCoordinatorRow');
  if (dlType === 'pre') {
    coordRow.style.display = '';
    document.getElementById('reviewCoordinator').textContent =
      document.getElementById('coordinatorApproval').checked ? '✅ Yes' : '❌ No';
  } else {
    coordRow.style.display = 'none';
  }

  document.getElementById('reviewEvent').textContent = document.getElementById('eventName').value;
  document.getElementById('reviewDate').textContent = document.getElementById('eventDate').value;
  document.getElementById('reviewLocation').textContent = document.getElementById('eventLocation').value;

  const gpsFile = document.getElementById('gpsPhoto').files[0];
  const docFile = document.getElementById('supportingDoc').files[0];
  const partFile = document.getElementById('participationProof').files[0];
  const reqDocFile = document.getElementById('preApprovalDoc').files[0];

  if (dlType === 'pre') {
    document.getElementById('reviewPostDlDocs').style.display = 'none';
    document.getElementById('reviewPreDlDocs').style.display = 'block';
    document.getElementById('reviewParticipationProof').innerHTML = filePreviewHTML(partFile, 'Participation Proof');
    document.getElementById('reviewPreApprovalDoc').innerHTML = filePreviewHTML(reqDocFile, 'Signed Approval');
  } else {
    document.getElementById('reviewPostDlDocs').style.display = 'block';
    document.getElementById('reviewPreDlDocs').style.display = 'none';
    document.getElementById('reviewGPS').innerHTML = filePreviewHTML(gpsFile, 'GPS Photo');
    document.getElementById('reviewDoc').innerHTML = filePreviewHTML(docFile, 'Supporting Document');
  }
}

// ═══════════════════════════════════════════════════════
//  FORM SUBMISSION — uses selected_lat / selected_lng
// ═══════════════════════════════════════════════════════
document.getElementById('dlForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  // FORCE VALIDATION — must have real coordinates
  if (!selected_lat || !selected_lng) {
    alert("Please select location on map");
    return;
  }

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  const { dlType, campusType } = getDetectedValues();

  const formData = new FormData();
  formData.append('event_name', document.getElementById('eventName').value);
  formData.append('event_date', document.getElementById('eventDate').value);
  formData.append('event_location', document.getElementById('eventLocation').value);
  formData.append('event_lat', selected_lat.toFixed(7));
  formData.append('event_lng', selected_lng.toFixed(7));

  // Send event_id for attendance verification matching
  const eventIdValue = (document.getElementById('eventId')?.value || '').trim();
  if (eventIdValue) {
    formData.append('event_id', eventIdValue);
  }

  if (dlType === 'pre') {
    formData.append('coordinator_approval', document.getElementById('coordinatorApproval').checked ? '1' : '0');
  }

  const gpsFile = document.getElementById('gpsPhoto').files[0];
  const docFile = document.getElementById('supportingDoc').files[0];
  const partFile = document.getElementById('participationProof').files[0];
  const reqDocFile = document.getElementById('preApprovalDoc').files[0];

  if (dlType === 'pre') {
    if (reqDocFile) formData.append('gps_photo', reqDocFile);
    if (partFile) formData.append('supporting_doc', partFile);
  } else {
    if (gpsFile) formData.append('gps_photo', gpsFile);
    if (docFile) formData.append('supporting_doc', docFile);
  }

  try {
    const res = await fetch('/api/dl/student/apply-dl', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.success) {
      showToast(`DL submitted! Type: ${data.dl_type.toUpperCase()}-DL, Campus: ${data.campus_type}`, 'success');
      setTimeout(() => window.location.href = '/dl-status', 2000);
    } else {
      showToast(data.error || 'Submission failed', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = '✓ Submit Application';
    }
  } catch (err) {
    showToast('Server error. Please try again.', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = '✓ Submit Application';
  }
});

// ═══════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
