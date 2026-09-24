// utils/SampleCandidate.js — a specific, real candidate account confirmed
// live (2026-09-16) to already exist in this environment: manually signed
// up by the user themselves and confirmed to reach "Application Form -
// Phase 1". Kept here as a reusable, known-registered fixture (e.g. for
// duplicate-Aadhaar rejection checks) - separate from config.DuplicateTestAadhar,
// which serves the same general purpose with different data and is left
// untouched elsewhere in the suite.
module.exports = {
  aadhaar: '123456789012',
  email: 'prasoonchauhan7090@gmail.com',
  password: 'Mankind@1234',
  referenceId: '10001556',
};
