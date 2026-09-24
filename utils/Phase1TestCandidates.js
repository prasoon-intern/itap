// utils/Phase1TestCandidates.js — a small, dedicated pool of already-
// registered candidate accounts reused across the Candidate Application
// Form (Phase 1) 51-test-case suite, for tests that don't need a genuinely
// fresh/untouched account (see tests/Candidate/Phase1.spec.js's own header
// comment for which tests those are).
//
// Kept separate from utils/SampleCandidate.js on purpose — that file belongs
// conceptually to the Sign In/Sign Up module, not Phase 1.
//
// Safety verified live (2026-09-17), before this pool was ever relied on: a
// Next click that gets blocked by validation (the shape every mandatory-
// field/format negative test in this suite uses) does NOT persist any data
// on the candidate's account — confirmed by filling First/Last Name, leaving
// PAN blank, getting blocked by validation, then both reloading the page and
// signing in fresh as the same candidate in a brand-new browser session:
// every field came back empty both times. A blocked Next is safe to repeat
// against the same pooled account any number of times.
//
// Only one candidate in the pool, per explicit instruction ("if you require
// only one then make only sample candidate") — no concrete need for more was
// found; every pooled test in this suite either never successfully submits
// (negative/mandatory-field tests, which the safety check above covers) or
// never submits anything at all (static-text, dropdown-option, and toggle
// checks).
//
// ---- experienceCandidate1 (added 2026-09-24, purely ADDITIVE) ----
// candidate1 above must NOT be used for the Experience Details (section 3)
// tests: it has only ever completed Personal Details, so reaching section 3
// with it would still mean filling Qualification Details from scratch every
// time.
//
// experienceCandidate1 is a second, dedicated pooled account that has
// already completed BOTH Personal Details AND Qualification Details via real
// "Next" clicks (one-time setup, 2026-09-24). That makes the Experience
// Details section reachable on any later sign-in in ~14s via a two-hop step-
// indicator jump (Personal -> Qualification -> Experience; see
// newPooledExperienceSession() in tests/Candidate/Phase1.spec.js), instead of
// the ~1.1 min a fresh signup + full Personal + full Qualification refill
// costs.
//
// Verified live (2026-09-24) on a fresh sign-in as this account:
//   - it lands on Personal Details with the previous submission's data intact;
//   - clicking the "2. Qualification Details" step circle opens Qualification
//     Details with every value still populated (10th 02/02/2010-02/02/2011,
//     80.00; 12th 02/02/2012-02/02/2013; Graduation B.Sc./Distance,
//     02/02/2014-02/02/2018, 90.00);
//   - clicking the "3. Experience Details" circle from there opens section 3.
//     (The jump must be TWO hops - Personal -> Experience directly is blocked
//     with an "Fill all Qualification details" Information dialog, which is
//     exactly what TC_90 covers.)
//
// CRITICAL - this account must NEVER be submitted. The Experience Details
// Submit shows "Are you sure you want to submit? Please ensure all the
// details are correct as you will not be able to edit these later." and a
// real submission permanently consumes the account (the form becomes
// read-only / the candidate moves on to Phase 2). Every pooled test in
// section 3 therefore either never reaches a valid submission (its own
// mandatory-field validation blocks it) or explicitly clicks "No" on that
// confirmation dialog - see submitAndCancelIfConfirmed() in
// pages/Candidate/Phase1.js. Tests that genuinely DO submit (TC_96) use a
// throwaway fresh signup via newFreshExperienceSession() instead.
module.exports = {
  candidate1: {
    aadhaar: '700011992233',
    email: 'discovery.candidate18@gmail.com',
    password: 'Mankind@1234',
  },
  experienceCandidate1: {
    aadhaar: '700011992244',
    email: 'discovery.candidate18@gmail.com',
    password: 'Mankind@1234',
  },
};
