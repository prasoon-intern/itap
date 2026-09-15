// utils/DailyCandidateNaming.js
// Generates candidate names for Interview automation runs that create a
// fresh candidate: "test01" for the first run of the day, "test02" for the
// second, etc. Counter resets automatically when the date changes.
const fs = require('fs');
const path = require('path');

const COUNTER_FILE = path.join(__dirname, '..', 'run-reports', 'dailyCandidateCounter.json');

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function readCounter() {
  try {
    return JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8'));
  } catch (e) {
    return { date: todayStr(), count: 0 };
  }
}

function writeCounter(state) {
  fs.mkdirSync(path.dirname(COUNTER_FILE), { recursive: true });
  fs.writeFileSync(COUNTER_FILE, JSON.stringify(state, null, 2));
}

/**
 * Returns the next candidate name for today's runs, e.g. "test01", "test02".
 * Persists the counter to disk so it survives across separate process runs.
 */
function getNextTestCandidateName() {
  const today = todayStr();
  let state = readCounter();
  if (state.date !== today) {
    state = { date: today, count: 0 };
  }
  state.count += 1;
  writeCounter(state);
  return `test${String(state.count).padStart(2, '0')}`;
}

module.exports = { getNextTestCandidateName };
