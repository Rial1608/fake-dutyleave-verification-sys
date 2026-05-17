const mongoose = require('mongoose');

// ════════════════════════════════════════════════════════════════
// COUNTER SCHEMA — auto-increment IDs for DutyLeave
// ════════════════════════════════════════════════════════════════

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
}, { collection: 'counters' });

const Counter = mongoose.model('Counter', counterSchema);

async function getNextDlId() {
  const counter = await Counter.findByIdAndUpdate(
    'dlId',
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return counter.seq;
}

module.exports = { Counter, getNextDlId };
