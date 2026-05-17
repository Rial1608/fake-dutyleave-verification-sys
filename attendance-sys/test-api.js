#!/usr/bin/env node

/**
 * API Test Script - Tests basic endpoint functionality
 * Waits for server to be ready, then tests core endpoints
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';
const TIMEOUT = 30000; // 30 seconds total timeout

// Helper function to make HTTP requests
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Test functions
async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer() {
  console.log('⏳ Waiting for server to be ready...');
  const startTime = Date.now();
  
  while (Date.now() - startTime < TIMEOUT) {
    try {
      const response = await makeRequest('GET', '/');
      if (response.status === 200 || response.status === 404) {
        console.log('✅ Server is ready!\n');
        return true;
      }
    } catch (e) {
      // Server not ready, wait and retry
      await wait(500);
    }
  }
  
  throw new Error('Server did not become ready in time');
}

async function testGetAllForms() {
  console.log('📋 Test 1: GET /api/forms (get all forms)');
  try {
    const response = await makeRequest('GET', '/api/forms');
    if (response.status === 200) {
      console.log('   ✅ Status: 200 OK');
      console.log('   ✅ Response:', JSON.stringify(response.data, null, 2).substring(0, 200));
      return true;
    } else {
      console.log(`   ❌ Unexpected status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return false;
  }
}

async function testCreateForm() {
  console.log('\n📝 Test 2: POST /api/forms (create form)');
  try {
    const formData = {
      eventName: 'Test Event',
      eventLocation: { latitude: 26.9124, longitude: 75.7873, address: 'Jaipur' },
      eventDateTime: new Date().toISOString(),
      organizerId: 'org_123',
      organizerName: 'Test Organizer',
      fields: [
        { id: 'field_1', label: 'Name', type: 'text', required: true },
        { id: 'field_2', label: 'Email', type: 'email', required: true }
      ],
      maxLocationDistance: 100
    };

    const response = await makeRequest('POST', '/api/forms', formData);
    if (response.status === 201) {
      console.log('   ✅ Status: 201 Created');
      const form = response.data.data || response.data.form;
      if (form && form.formId) {
        console.log(`   ✅ Form created with ID: ${form.formId}`);
        console.log(`   ✅ Event: ${form.eventName}`);
        return form.formId;
      }
    } else {
      console.log(`   ❌ Unexpected status: ${response.status}`);
      console.log('   Response:', response.data);
    }
    return false;
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return false;
  }
}

async function testGetForm(formId) {
  console.log(`\n🔍 Test 3: GET /api/forms/${formId} (get single form)`);
  try {
    const response = await makeRequest('GET', `/api/forms/${formId}`);
    if (response.status === 200) {
      console.log('   ✅ Status: 200 OK');
      const form = response.data.data || response.data;
      console.log(`   ✅ Form retrieved: ${form.eventName}`);
      return true;
    } else {
      console.log(`   ❌ Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return false;
  }
}

async function testGetOrganizerForms() {
  console.log('\n👔 Test 4: GET /api/forms/organizer/org_123 (get organizer forms)');
  try {
    const response = await makeRequest('GET', '/api/forms/organizer/org_123');
    if (response.status === 200) {
      console.log('   ✅ Status: 200 OK');
      console.log('   ✅ Response:', JSON.stringify(response.data, null, 2).substring(0, 300));
      return true;
    } else {
      console.log(`   ❌ Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return false;
  }
}

async function runTests() {
  try {
    await waitForServer();
    
    const test1 = await testGetAllForms();
    const formId = await testCreateForm();
    const test3 = formId ? await testGetForm(formId) : false;
    const test4 = await testGetOrganizerForms();

    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Summary:');
    console.log(`   ✅ GET /api/forms: ${test1 ? 'PASS' : 'FAIL'}`);
    console.log(`   ✅ POST /api/forms: ${formId ? 'PASS' : 'FAIL'}`);
    console.log(`   ✅ GET /api/forms/:id: ${test3 ? 'PASS' : 'FAIL'}`);
    console.log(`   ✅ GET /api/forms/organizer/:id: ${test4 ? 'PASS' : 'FAIL'}`);
    console.log('='.repeat(50));

    if (test1 && formId && test3 && test4) {
      console.log('\n🎉 All tests PASSED!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some tests FAILED');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test suite error:', error.message);
    process.exit(1);
  }
}

// Run tests
runTests();
