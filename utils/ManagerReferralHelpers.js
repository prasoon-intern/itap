// utils/ManagerReferralHelpers.js
// Shared random-data generators for the Manager Referral suite, in the same
// style as getRandomAadhar() in utils/CandidateFlowHelpers.js.

// 10-digit mobile number starting 6-9, matching the shape used by every
// positive-path example in the test-case workbook (e.g. "9876543210").
function getRandomMobile() {
  const first = Math.floor(6 + Math.random() * 4).toString();
  const rest = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
  return `${first}${rest}`;
}

// Unique-per-call email address, so repeated positive-path referral
// submissions in the same run never collide on the same address.
function getRandomReferralEmail() {
  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return `qa.referral.${unique}@gmail.com`;
}

module.exports = { getRandomMobile, getRandomReferralEmail };
