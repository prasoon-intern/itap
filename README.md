# Candidate Onboarding & Appointment Module — Playwright JS

Playwright Test suite covering the Mendix candidate onboarding flow
(`p/candidatelogin`) and the FC Admin appointment/interview/training flows.

## Project Structure

The dashboard has 6 modules. **Candidate**, **Interview**, and **Onboarding**
are split into one file per test cluster, each with its own matching
page-object file, grouped under a subfolder in both `pages/` and `tests/`.
**Training** and **Open Training** currently each get one page-object file +
one spec file. **HR** (2026-09-08) holds only Document Verification so far —
it was split out of Onboarding into its own module since it's a distinct
HR-only portal, not an FC Admin page.

| Module | Page object(s) | Spec file(s) | Covers | Status |
|---|---|---|---|---|
| Candidate — Signup & Sign-In | `pages/Candidate/SignUpSignIn.js` | `tests/Candidate/SignUpSignIn.spec.js` | Candidate signup modal, sign-in, Forgot Password | ✅ Validated |
| Candidate — Phase 1 | `pages/Candidate/Phase1.js` | `tests/Candidate/Phase1.spec.js` | Personal / Qualification / Experience Details | ✅ Validated |
| Candidate — Phase 2 | `pages/Candidate/Phase2.js` | `tests/Candidate/Phase2.spec.js` | Document upload | ✅ Validated |
| Interview — Setup | `pages/Interview/Setup.js` | `tests/Interview/Setup.spec.js` | Candidate search/select, Schedule Interview form, Allocate/Submit/Confirm | ✅ Validated |
| Interview — Preview Interviewer Email | `pages/Interview/PreviewInterviewerEmail.js` | `tests/Interview/PreviewInterviewerEmail.spec.js` | Interviewer email preview tab | ✅ Validated |
| Interview — Preview Candidate Email | `pages/Interview/PreviewCandidateEmail.js` | `tests/Interview/PreviewCandidateEmail.spec.js` | Candidate email preview tab | ✅ Validated |
| Interview — Status & Feedback | `pages/Interview/StatusFeedback.js` | `tests/Interview/StatusFeedback.spec.js` | Candidate Status popup, Final Status, Feedback capture (+ the standalone Feedback-MR form) | ✅ Validated |
| Interview — everything else | `pages/Interview.js` | `tests/Interview.spec.js` | Re-Schedule Interview, Access Control, Login, Grid/Filters — not yet split further | ✅ Validated — *not yet split into per-cluster files* |
| Onboarding — Gen Offer Letter | `pages/Onboarding/GenOfferLetter.js` | `tests/Onboarding/GenOfferLetter.spec.js` | The full Offer Letter flow: Letter Details → Preview Letter → Preview Candidate Email → real send | ✅ Validated |
| Onboarding — Gen Appointment Letter | `pages/Onboarding/GenAppointmentLetter.js` (re-exports `ITAP_GenerateOfferLetter`) | `tests/Onboarding/GenAppointmentLetter.spec.js` | Same 3-tab Generate Letter flow as Gen Offer Letter, against a Document-Verification-verified candidate | ✅ Validated |
| Onboarding — Gen Apprentice Letter | `pages/Onboarding/GenApprenticeLetter.js` (re-exports `ITAP_GenerateOfferLetter`, not yet imported by the spec — see note below) | `tests/Onboarding/GenApprenticeLetter.spec.js` | The 2 real negative validation gates (experienced-candidate block, non-MCPPL-division block) | ⚠️ **Partial draft** — positive path skipped, see note below |
| Onboarding — everything else | `pages/Onboarding.js` | `tests/Onboarding.spec.js` | Page structure/UI, grid search & filters, Export To Excel, Document Status popup — not yet split further | ✅ Validated — *not yet split into per-cluster files* |
| HR — Document Verification | `pages/HR/DocumentVerification.js` | `tests/HR/DocumentVerification.spec.js` | The HR (nimisha) portal: Verification Pending/Completed, per-document Verify checkboxes, Field Coordinator, Verify | ✅ Validated |
| Training | `pages/Training.js` | `tests/Training.spec.js` | FC Admin Training tab: batch creation, candidate assignment, email — a real, required step between Interview and Onboarding in the candidate journey | ⚠️ **Unfinished draft, not validated** — see warning below |
| Open Training | `pages/OpenTraining.js` | `tests/OpenTraining.spec.js` | FC Admin Open Training module | ⚠️ Login credentials in the file are currently stale/invalid |

> **No standalone Interview end-to-end flow file, either.** There used to be
> a `tests/Interview/Process.spec.js` + `pages/Interview/Process.js` covering
> the full schedule→both-emails→feedback→final-status journey as one
> continuous chain in a single browser session. It was removed (2026-09-02),
> same reasoning as Candidate's FullFlow removal below: Setup,
> PreviewInterviewerEmail, PreviewCandidateEmail, and StatusFeedback already
> validate every step it used to walk through, each independently with its
> own fresh candidate — PreviewCandidateEmail.spec.js's own `beforeAll`
> already sends the interviewer email for real (required to reach its tab at
> all), and its own tests already send the candidate email, so nothing
> needed to be added elsewhere to replace it. The one thing intentionally
> **not** replaced: a single test proving the *entire* journey connects
> correctly end-to-end in one continuous session (e.g. that a successful
> candidate-email send actually unlocks the feedback step) — every remaining
> file creates its own fresh candidate and jumps straight to its own state
> independently, so that specific "does it all really connect" coverage no
> longer exists as its own check.

> **No standalone Candidate end-to-end flow file.** There used to be a
> `Candidate/FullFlow.spec.js` covering the full signup→Phase 1→Phase 2
> journey as one 58-step chain, mirroring `flowConfig.json`'s branching
> options (signup vs. login, address same/different, etc.). It was removed
> (2026-09-02) since `utils/createFreshInterviewCandidate.js` already drives
> a fresh candidate through the exact same journey for every Interview/
> Onboarding test that needs one — the standalone duplicate wasn't adding
> coverage. `flowConfig.json` is now a fully dead file — see the Notes
> section below.

> **Training module warning:** `pages/Training.js` was never fully wired up —
> `searchRegID()` ignores its caller's candidate ID and hardcodes `'25566'`, and
> both `selectCheckboxByRegID()` and `selectCandidateCheckboxInBatch()` accept a
> candidate ID parameter but never use it, instead hardcoding a different stale
> ID (`'25568'`) and clicking the first generic checkbox on the page. It also
> has no `config.js` integration and no `excelReporter` results tracking.
> Confirmed live (2026-09-01): it fails at TC04 for exactly this reason. It's
> kept in the framework rather than removed because Training is a genuinely
> required step in the real candidate journey (Interview → Training →
> Onboarding), not because this version can be trusted to pass — treat it as a
> starting point to finish, not as working coverage.

> **Interview and Onboarding are both partially split (2026-09-02) — the
> grid/header code stays unsplit by design.** `pages/Interview.js` still
> holds `ITAP_InterviewGrid` and `ITAP_ReScheduleInterview` — used by the
> still-unsplit Re-Schedule Interview, Access Control, Login, and
> Grid/Filters describe blocks in `tests/Interview.spec.js`. Likewise,
> `pages/Onboarding.js` still holds only `ITAP_OnboardingGrid` — used by the
> still-unsplit Document Status Popup and Page Structure/Grid & Filters
> describe blocks in `tests/Onboarding.spec.js`. Both are read-only, page-
> structure-level coverage with no natural single cluster to join, so they
> stay in the base file the same way `Interview.js` does.
>
> **Gen Appointment Letter has no page-object file of its own.**
> `pages/Onboarding/GenAppointmentLetter.js` just re-exports
> `ITAP_GenerateOfferLetter` from `pages/Onboarding/GenOfferLetter.js` — both
> letter types open the exact same 3-tab Generate Letter page pattern in
> Mendix, and every field in that class is located by its visible label text
> rather than a page-specific widget id, so one class genuinely serves both
> without duplication.
>
> **Gen Apprentice Letter's page file exists ahead of need.**
> `pages/Onboarding/GenApprenticeLetter.js` already re-exports
> `ITAP_GenerateOfferLetter`, the same way Gen Appointment Letter's does, but
> `tests/Onboarding/GenApprenticeLetter.spec.js` doesn't import it yet — its 2
> real tests (`ONB-PL-01`, `ONB-PL-02`) are both negative gates that block
> before the actual Generate Apprentice Letter page ever opens, so they only
> need `ITAP_OnboardingGrid`. The positive path (`ONB-PL-03`) is `test.skip`'d
> pending an MCPPL-division `ManagerRefID` to create the right candidate with
> — once that's available, wire up the already-existing page file for real
> field access.

```
playwright-js/
├── config.js                          # URL, credentials, candidate details
├── flowConfig.json                    # Frozen leftover from the removed scenario-picker UI — see note below
├── package.json
├── playwright.config.js
├── server.js / dashboard.html / automation-dashboard.html / test-runner.html
│                                       # Local dashboards: '/' redirects to automation-dashboard
│                                       # (run tests, browse history); dashboard.html is a read-only
│                                       # history viewer for runs made before the scenario picker was removed
├── excelReporter.js                   # Writes TestResults.xlsx + run-reports/*.json (once per run)
├── utils/
│   ├── BrowserFactory.js              # Browser launch + shared low-level action helpers
│   ├── Globals.js                     # Cross-test state (e.g. generated ITAP number)
│   ├── CandidateFlowHelpers.js        # Shared candidate signup → Phase 1 driver functions
│   ├── DailyCandidateNaming.js        # Daily-incrementing test candidate names (test01, test02, ...)
│   ├── DateHelpers.js                 # Future-date string helpers (keeps hardcoded dates from going stale)
│   ├── createFreshInterviewCandidate.js    # Drives one candidate through signup → Phase 2 submission
│   └── createClearedOnboardingCandidate.js # Drives a candidate through Interview to a given Final Status
├── pages/
│   ├── BasePage.js                    # Shared Playwright action wrapper — FC Admin page objects extend this
│   ├── FCAdminLogin.js                # Shared FC Admin login (used by both Interview and Onboarding)
│   ├── Candidate/
│   │   ├── SignUpSignIn.js            # ITAP_LoginPage + ITAP_AlreadySignedUserPage
│   │   ├── Phase1.js                  # ITAPInterviewPerformaPage + ITAP_QualificationDetailsPage + ITAP_ExperienceDetailPage
│   │   └── Phase2.js                  # ITAP_ContinueToPhase2Page
│   ├── Interview/
│   │   ├── Setup.js                   # ITAP_InterviewSetup
│   │   ├── PreviewInterviewerEmail.js # ITAP_PreviewInterviewerEmail
│   │   ├── PreviewCandidateEmail.js   # ITAP_PreviewCandidateEmail
│   │   └── StatusFeedback.js          # ITAP_InterviewStatusFeedback + ITAP_fillFeedbackform
│   ├── Interview.js                   # ITAP_InterviewGrid + ITAP_ReScheduleInterview (not yet split further — see note above)
│   ├── Onboarding/
│   │   ├── GenOfferLetter.js          # ITAP_GenerateOfferLetter
│   │   ├── GenAppointmentLetter.js    # Re-exports ITAP_GenerateOfferLetter
│   │   └── GenApprenticeLetter.js     # Re-exports ITAP_GenerateOfferLetter (created ahead of need — see note above)
│   ├── Onboarding.js                  # ITAP_OnboardingGrid only (not yet split further — see note above)
│   ├── HR/
│   │   └── DocumentVerification.js    # ITAP_DocumentVerification — its own module (2026-09-08), not FC Admin
│   ├── Training.js                    # Training module
│   └── OpenTraining.js                # Open Training module
├── tests/
│   ├── Candidate/
│   │   ├── SignUpSignIn.spec.js       # Signup + Sign-In validation
│   │   ├── Phase1.spec.js             # Phase 1 validation
│   │   └── Phase2.spec.js             # Phase 2 validation
│   ├── Interview/
│   │   ├── Setup.spec.js              # Schedule Interview Form Validation, Multi-Candidate, Schedule Edge Cases
│   │   ├── PreviewInterviewerEmail.spec.js # Interviewer email tab validation
│   │   ├── PreviewCandidateEmail.spec.js   # Candidate email tab validation
│   │   └── StatusFeedback.spec.js     # Feedback Capture, Final Status (Rejected path), Candidate Status Update
│   ├── Interview.spec.js              # Re-Schedule Interview, Access Control, Login, Grid/Filters (not yet split further — see note above)
│   ├── Onboarding/
│   │   ├── GenOfferLetter.spec.js          # Full Offer Letter flow, including a real send
│   │   ├── GenAppointmentLetter.spec.js    # Full Appointment Letter flow, including a real send
│   │   └── GenApprenticeLetter.spec.js     # 2 negative gates; positive path skipped (see note above)
│   ├── Onboarding.spec.js             # Document Status Popup, Page Structure/Grid & Filters (not yet split further — see note above)
│   ├── HR/
│   │   └── DocumentVerification.spec.js    # HR portal: Verification Pending/Completed, Verify flow — its own module (2026-09-08)
│   ├── Training.spec.js               # Training module
│   └── OpenTraining.spec.js           # Open Training module
└── upload-files/                      # Document images used by Candidate/*.spec.js uploads
```

## Setup

```bash
npm install
npx playwright install
```

## Run Tests

```bash
# Run all tests
npm test

# Run every Candidate file, or just one cluster
npm run test:candidate
npm run test:signupsignin
npm run test:phase1
npm run test:phase2

# Run every Interview file, or just one cluster
npm run test:interview
npm run test:interview-setup
npm run test:interview-interviewer-email
npm run test:interview-candidate-email
npm run test:interview-statusfeedback

# Run every Onboarding file, or just one cluster
npm run test:onboarding
npm run test:onboarding-offerletter
npm run test:onboarding-appointmentletter
npm run test:onboarding-apprenticeletter

# Run the HR module (Document Verification)
npm run test:hr-docverification

# Run one module's whole file (headed)
npm run test:training
npm run test:opentraining

# Run just one describe block or test within a module file
npx playwright test tests/Interview.spec.js --grep "FC Admin - Login"

# View HTML report
npm run report

# Local dashboard for running tests and viewing history (http://localhost:3000)
npm run dashboard
```

Set `HEADLESS=true` in the environment before running tests or the dashboard to run
without a visible browser window.

## Notes

- Every `test.describe.serial` block runs its tests as one continuous chain — each
  step depends on state (browser session, previously-filled form fields, a freshly
  created candidate, etc.) left behind by the step before it. Within `Interview.spec.js`,
  `tests/Interview/Setup.spec.js`, `tests/Interview/PreviewInterviewerEmail.spec.js`,
  `tests/Interview/PreviewCandidateEmail.spec.js`, `tests/Interview/StatusFeedback.spec.js`,
  `Onboarding.spec.js`, and every file under `tests/Onboarding/` there are several
  *independent* serial blocks (one per feature area), each creating its own fresh
  candidate/session in its own `beforeAll` — you can safely run just one block on its
  own. There is no single file spanning the entire schedule→email→feedback→status
  journey as one chain anymore (see the callout above) — every Interview and
  Onboarding block is independent by design now.
  All 3 Candidate files are similarly independent, self-contained test cases (each test
  drives its own fresh signup via `utils/CandidateFlowHelpers.js`) — none of them chain
  into each other.
- `flowConfig.json` is now a frozen, dead file (2026-09-02) — it was only ever written
  by `server.js`'s `/run` endpoint, which powered the `index.html` scenario-picker UI.
  Both were removed since the E2E flow files that UI drove (`Candidate/FullFlow.spec.js`,
  `Interview/Process.spec.js`) were already deleted as redundant duplicates. Nothing
  reads its scenario-branching fields (signup vs. login, address same/different, etc.)
  anymore; `excelReporter.js` no longer reads its `reportSheetName` field either — it
  now generates a fresh timestamped sheet name itself for every run, so results never
  silently overwrite a previous run's tab in `TestResults.xlsx`.
- Upload files must exist at `upload-files/` relative to project root.
- Update `config.js` to change URL, credentials, or candidate details.
- This suite runs against a live dev environment and sends real emails to the configured
  addresses — avoid running the FC Admin email-confirmation steps more often than needed.
