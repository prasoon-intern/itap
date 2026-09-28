// utils/Phase2TestCandidates.js - pooled, already-registered candidate
// accounts for the Candidate Application Form (Phase 2) suite
// (tests/Candidate/Phase2.spec.js). Kept separate from
// utils/Phase1TestCandidates.js so Phase 1's own pool is never touched.
//
// Every account below has ALREADY genuinely completed and submitted Phase 1
// (fillValidPersonalDetails() + fillValidQualification() +
// ITAP_ExperienceDetailPage.fill_Experienced(), so "Are you experienced?" =
// Yes) and then clicked "Continue to Phase 2". Signing in as any of them
// therefore lands DIRECTLY on Phase 2 "1. Other Details" (~11s, see
// signInAndReachPhase2() in utils/CandidateFlowHelpers.js) instead of the
// ~111s full fresh route.
//
// Phase 1 data shared by all of them (from fillValidPersonalDetails()'s
// defaults, and carried into Phase 2's read-only fields - confirmed live
// 2026-09-25): Name "Discovery User 18", Mobile "9876543210", Email
// "discovery.candidate18@gmail.com", PAN "ATBPV6191F". They differ ONLY in
// Phase 1 Marital Status, which is what drives Phase 2's Date Of Marriage
// enable/disable branch:
//
//   single   - Marital Status "Single"   (Date Of Marriage disabled) - also
//              the general-purpose pooled account for non-branch tests.
//   married  - Marital Status "Married"  (Date Of Marriage ENABLED)
//   divorced - Marital Status "Divorced" (Date Of Marriage disabled)
//   widowed  - Marital Status "Widowed"  (Date Of Marriage disabled)
//   other    - Marital Status "Other"    (Date Of Marriage disabled)
//
// married/divorced/widowed/other were created one-time on 2026-09-25 via the
// fresh route with fillValidPersonalDetails()'s `maritalStatus` override
// (iTAP numbers 250571-250574); each one's Marital Status and Date Of
// Marriage state was read back live on its Phase 2 page right after
// creation. Never recreate them per test - sign back in instead.
//
// CRITICAL - never click Next on Other Details with a FULLY valid form on
// any of these accounts: that advances it to Upload Documents and changes
// what the next sign-in lands on. A Next blocked by validation (blank
// Dependent/UAN/Emergency Contact sections) is what every current test uses.
//
// State persistence (confirmed live 2026-09-25): typed values and a blocked
// Next do NOT persist to the next sign-in, but "Add Member" commits a new
// dependent row immediately. Any test that adds one must delete it again
// (ITAP_Phase2OtherDetailsPage.deleteAddedDependents()) so these accounts
// stay at exactly the default Father + Mother rows.
const password = 'Mankind@1234'; // = config.NewPassword

module.exports = {
  single:   { aadhaar: '907661151274', password, maritalStatus: 'Single' },
  married:  { aadhaar: '574030372966', password, maritalStatus: 'Married' },
  // NB (2026-09-25): `divorced` is the spare account TC_62 does a SUCCESSFUL
  // Next on. Its Other Details are therefore SAVED (Blood group A+, Religion
  // Hinduism, parent DOBs + Father as Nominee, member of PF = No - the app
  // also stores No for the three downstream PF/Pension questions - UAN
  // 876578765432, both Emergency Contact rows). Sign-in still lands on
  // Other Details, so TC_08 (Marital Status / Date Of Marriage only) is
  // unaffected - but don't use this account for blank-field tests.
  divorced: { aadhaar: '995131365728', password, maritalStatus: 'Divorced' },
  widowed:  { aadhaar: '820854323698', password, maritalStatus: 'Widowed' },
  other:    { aadhaar: '594542374973', password, maritalStatus: 'Other' },
  // Added 2026-09-25 (batch 4, TC_38): the ONLY experienced=No account in
  // this pool - every account above is experienced=Yes (read live). Created
  // one-time via the fresh route with Phase 1 Experience Details answered
  // "No" (ITAP_ExperienceDetailPage.fill_NotExperienced()), iTAP 250575;
  // "Are you experienced?" = No read back live on its Phase 2 page after a
  // fresh sign-in. Otherwise the same Phase 1 defaults as above.
  fresher:  { aadhaar: '422469444993', password, maritalStatus: 'Single', experienced: false },
  // Added 2026-09-28 (Upload Documents batch prep, TC_69/TC_70): originally a
  // throwaway probe account (iTAP 250577), promoted into the pool per the
  // user's direction to reuse an already-advanced account instead of making
  // a fresh one. Like `divorced`, this one has ALREADY had a SUCCESSFUL Next
  // on Other Details - confirmed live 2026-09-28 that signing back in still
  // lands on Other Details (fully saved: Blood group A+, Religion Hinduism,
  // experienced = No unlike every other account here), and a repeat Next
  // succeeds with zero validation messages, reaching Upload Documents with
  // General/Qualification/Dependent Documents only - no Experience Documents
  // block, as expected for a fresher. Don't use for blank-field Other
  // Details tests; safe to reuse for any Upload Documents check that
  // doesn't submit for real.
  //
  // REPLACED 2026-09-28 (Upload Documents batch 3, TC_85-96): the original
  // account's (iTAP 250577) Upload Documents consent checkbox got checked by
  // an early draft of TC_85/87/88/96 and, once discovered, turned out to be
  // permanently stuck - see the CONSENT IS A ONE-WAY LATCH warning below.
  // That permanently broke the pre-existing, previously-passing TC_84
  // ("Submit blocked when consent unchecked"), which hardcodes this account
  // and asserts unchecked-by-default with no way back through the UI (tried:
  // uncheck() + long waits, uncheck() + an unchecked Submit-click-and-
  // dismiss round trip, a same-session reload - none of it un-stuck the old
  // account). Replaced with a freshly-created equivalent (iTAP 250583, same
  // shape: experienced=No, Blood group A+, Religion Hinduism, both
  // dependents' DOBs set with Father as Nominee, PF member = No, UAN
  // 876578765432, both Emergency Contact rows filled, one real successful
  // Next already done) - confirmed live TC_84 passes again on it (consent
  // unchecked by default) and every other fresherUploads-based test still
  // behaves the same way. This was a deliberate, narrow, user-authorized
  // exception to "don't change existing account values" - only done because
  // today's own test-writing work caused the original account's damage.
  //
  // CONSENT IS A ONE-WAY LATCH (confirmed live 2026-09-28, applies to EVERY
  // account in this pool, not just this one): once the Upload Documents
  // consent checkbox is checked and the page round-trips even once, it can
  // never be unchecked again server-side - no test should check consent on
  // this or any other pooled/reusable account. Any test that needs to check
  // it must use a fresh, one-time disposable account instead (see
  // tests/Candidate/Phase2.spec.js's newDisposableUploadDocumentsSession()).
  fresherUploads: { aadhaar: '728661970777', password, maritalStatus: 'Single', experienced: false },
  // Added 2026-09-28 (TC_72, Dependent Documents / deceased dependent):
  // created one-time via a genuine fresh signup (iTAP 250578), specifically
  // because neither `divorced` nor `fresherUploads` has a dependent marked
  // deceased, and marking one on either of THOSE accounts would have
  // PERMANENTLY overwritten their existing saved Other Details state (a
  // successful Next commits server-side - see TC_62's own comment) for
  // every later test that reuses them. This account's own Other Details are
  // ALREADY SAVED (Blood group A+, Religion Hinduism, experienced = Yes):
  // Father ("Amandeep Singh") has a Date of Demise (15/08/2020, DOB
  // 15/08/1965) - i.e. DECEASED - and Mother ("Kashish Kaur", DOB
  // 15/08/1970) is the Nominee instead (a Nominee can't have a Date of
  // Demise). PF member = No, UAN 876578765432, both Emergency Contact rows
  // filled (Ravi Kumar/Brother, Sunita Devi/Sister). Confirmed live
  // 2026-09-28: a repeat Next succeeds with zero validation messages,
  // reaching Upload Documents with a document block for Mother ONLY - no
  // block for the deceased Father.
  //
  // RESERVED for TC_72 and future Dependent-Documents-deceased-dependent
  // regression ONLY - do NOT reuse this for any other Other Details/Upload
  // Documents check (its deceased-dependent state makes it incompatible
  // with tests that assume two ordinary, non-deceased Father+Mother rows,
  // e.g. TC_71).
  deceasedDependent: { aadhaar: '457263275671', password, maritalStatus: 'Single', experienced: true },
};
