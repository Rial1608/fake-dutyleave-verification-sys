/**
 * FIX UID DATA — One-time cleanup script
 * 
 * Problem: The student-form.js was using the FIRST form field as the UID,
 * which was "Student Name" — so names like "Ritik Sharma" were stored
 * in the uid field instead of actual UIDs like "25bcs13539".
 * 
 * This script:
 *  1. Finds all attendance records where uid looks like a name (contains spaces)
 *  2. Looks inside the responses object for the actual UID value
 *  3. Updates the record with the correct UID
 *  4. Deletes records that can't be fixed
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

async function fixUIDData() {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔧 UID DATA CLEANUP SCRIPT');
    console.log('═══════════════════════════════════════════════════════\n');

    // Connect
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const collection = db.collection('attendances');

    // Step 1: Show ALL records
    const allRecords = await collection.find({}).toArray();
    console.log(`📊 Total attendance records: ${allRecords.length}\n`);

    if (allRecords.length === 0) {
      console.log('No records found. Nothing to fix.');
      await mongoose.disconnect();
      return;
    }

    // Step 2: Identify bad records (uid contains space = likely a name)
    const badRecords = [];
    const goodRecords = [];

    for (const record of allRecords) {
      const uid = record.uid || '';
      const hasSpace = uid.includes(' ');
      const looksLikeUID = /^[a-z0-9]+$/i.test(uid.replace(/[_\-]/g, ''));

      console.log(`  Record: ${record.attendanceId}`);
      console.log(`    uid: "${uid}" ${hasSpace ? '❌ HAS SPACE (name!)' : '✅ OK'}`);
      console.log(`    eventId: ${record.eventId}`);
      
      // Show all response values to find the real UID
      if (record.responses) {
        const responses = record.responses instanceof Map 
          ? Object.fromEntries(record.responses) 
          : (typeof record.responses === 'object' ? record.responses : {});
        
        console.log(`    responses:`);
        for (const [key, value] of Object.entries(responses)) {
          console.log(`      ${key}: "${value}"`);
        }
      }
      console.log('');

      if (hasSpace || !looksLikeUID) {
        badRecords.push(record);
      } else {
        goodRecords.push(record);
      }
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log(`📊 Results: ${goodRecords.length} good, ${badRecords.length} bad`);
    console.log('═══════════════════════════════════════════════════════\n');

    if (badRecords.length === 0) {
      console.log('✅ No bad records found! All UIDs look correct.');
      await mongoose.disconnect();
      return;
    }

    // Step 3: Try to fix bad records by finding the real UID in responses
    let fixed = 0;
    let deleted = 0;

    for (const record of badRecords) {
      const responses = record.responses instanceof Map 
        ? Object.fromEntries(record.responses) 
        : (typeof record.responses === 'object' ? record.responses : {});

      let realUID = null;

      // Search responses for a value that looks like a UID (alphanumeric, no spaces)
      for (const [key, value] of Object.entries(responses)) {
        const val = String(value).trim();
        // UIDs are typically alphanumeric like "25BCS13539" — no spaces
        if (val && !val.includes(' ') && /^[a-z0-9]+$/i.test(val) && val.length >= 5) {
          // Check it's not the same as the current (wrong) uid
          if (val.toLowerCase() !== record.uid.toLowerCase()) {
            realUID = val.toLowerCase();
            console.log(`  🔧 Record ${record.attendanceId}:`);
            console.log(`     OLD uid: "${record.uid}" (name)`);
            console.log(`     NEW uid: "${realUID}" (from responses)`);
            break;
          }
        }
      }

      if (realUID) {
        // Fix the record
        await collection.updateOne(
          { _id: record._id },
          { 
            $set: { 
              uid: realUID,
              uniqueKey: `${realUID}_${record.formId}_${record.eventId}`
            } 
          }
        );
        console.log(`     ✅ FIXED!\n`);
        fixed++;
      } else {
        // Can't determine real UID — delete the record
        console.log(`  🗑️  Record ${record.attendanceId}: Cannot determine real UID — DELETING`);
        console.log(`     uid was: "${record.uid}"`);
        await collection.deleteOne({ _id: record._id });
        console.log(`     ❌ DELETED\n`);
        deleted++;
      }
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log(`🏁 CLEANUP COMPLETE`);
    console.log(`   Fixed: ${fixed}`);
    console.log(`   Deleted: ${deleted}`);
    console.log(`   Already OK: ${goodRecords.length}`);
    console.log('═══════════════════════════════════════════════════════\n');

    // Step 4: Verify — show final state
    const finalRecords = await collection.find({}).toArray();
    console.log('📋 Final state of all records:');
    for (const r of finalRecords) {
      console.log(`  uid: "${r.uid}" | eventId: ${r.eventId} | status: ${r.status}`);
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (err) {
    console.error('❌ Script error:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixUIDData();
