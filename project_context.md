# ITAP QA Automation — Project Context

Read this in full before doing anything. It's the handoff state for a Playwright-based
test automation suite for the ITAP (Mendix) HR/recruitment platform used by Mankind
Pharma, at `D:\itap`. There's also a persistent memory system (separate from this file)
with two saved entries: "keep changes scoped, no rearchitecting" and "Excel test cases
first, automation only when explicitly told" — check those too.

## Established workflow — apply this to every module, including new ones

1. Build an Excel workbook under `Test Cases/` as the source-of-truth test case list
   FIRST. Standard 10-column format (1-indexed, header is row 1):
   `S.No(1), Testcase_id(2), Testcase name(3), Testcase description(4), Testcasetype(5),
   Preconditions/testdata(6), Steps(7), Expected Result(8), Actual Result(9), Status(10)`.
2. Do NOT write automation until the user explicitly says to. Build Excel test cases
   section-by-section as the user shares screenshots/flow for each part of the module.
3. Once told to automate, write Playwright tests traceable to Excel: test titles read
   `TC_XX: ...` with a `// Excel TC_XX` comment directly above each test.
4. Verify every test live against the real running app — never assume behavior.
5. Update Excel's Actual Result/Status columns with genuine run results, not placeholders.
6. Keep `server.js`'s `PROJECTS` config + `automation-dashboard.html` wired so the
   module's tests run/display in the dashboard.

## Division → Reference ID mapping (reused across modules, keep verbatim)
Mankind 10001556 · Discovery 10039105 · Nobelis 10002001 · Curis 10001997 ·
Agri 10039037 · Alpha 10019233

## Completed modules — STABLE, do not modify without explicit new instruction
- **Manager Referral** — 71 tests. `tests/ManagerReferral/Page.spec.js` + `Report.spec.js`.
  Source: `Test Cases/ManagerReferral_TestCases.xlsx`. Uses `BrowserFactory`'s
  shared-session pattern (`{shared:true}` + `resetForNextTest()`).
- **Candidate Sign In & Sign Up** — 48 tests. `tests/Candidate/SignIn.spec.js` +
  `SignUp.spec.js`. Source: `Test Cases/candidateSignInSignUp.xlsx`. Also shared-session.
- **Candidate Application Form — Phase 1** — 119 tests, fully live-verified.
  `tests/Candidate/Phase1.spec.js`. Source: `Test Cases/Candidate Application Form.xlsx`,
  sheet `Phase1`. Result: 108 Passed / 11 Failed / 0 Pending — every failure is a
  documented, live-confirmed app defect with a Priority (P1-P3) in the workbook's 11th
  column ("Priority"), the user's own ruling per case, not inferred from similar ones.
  `pages/Candidate/Phase1.js` and the Phase-1-relevant parts of
  `utils/CandidateFlowHelpers.js` are SHARED with Phase 2 (below) — stable, but expect
  to extend them additively (not rewrite) when Phase 2 resumes.

**Files off-limits** without being asked again: `tests/ManagerReferral/`,
`pages/ManagerReferral/`, `Test Cases/ManagerReferral_TestCases.xlsx`,
`tests/Candidate/SignIn.spec.js`, `tests/Candidate/SignUp.spec.js`,
`pages/Candidate/SignUpSignIn.js`, `Test Cases/candidateSignInSignUp.xlsx`,
`utils/SampleCandidate.js`, `tests/Candidate/Phase1.spec.js`.

## Currently in progress / not yet started — will follow the same pattern as the completed modules above

- **Candidate Application Form (Phase 2)** — deferred, not started.
- **FC Admin Interview** — not started. Legacy Excel/automation already exists
  (`Test Cases/Fc_admin interview.xlsx`, `pages/Interview.js` + `pages/Interview/`,
  `tests/Interview.spec.js` + `tests/Interview/*.spec.js`) — don't assume it should be
  reused or ignored; that's a decision to make with the user when this module starts,
  same as was done for Candidate Application Form.
- **FC Admin Onboarding** — not started. Legacy Excel/automation already exists
  (`Test Cases/Onboarding Test Cases.xlsx`, `pages/Onboarding.js` + `pages/Onboarding/`,
  `tests/Onboarding.spec.js` + `tests/Onboarding/*.spec.js`) — same caveat as above.
- **HR Document Verification** — not started. Overlaps with
  `pages/Onboarding/DocumentVerification.js` / `tests/HR/DocumentVerification.spec.js` —
  whether this is its own module or part of Onboarding needs clarifying with the user
  first. No dedicated Excel workbook found yet for it specifically.

Other legacy workbooks exist but haven't been inspected: `Test Cases/Lifecycle
Automation Test Cases.xlsx`, `Test Cases/Modification Test Cases.xlsx`,
`Test Cases/Login Page Test Cases.xlsx`.

There are also several stray `.claude/worktrees/agent-*/` directories on disk that
aren't registered git worktrees (`git worktree list` only shows the main `D:/itap`
checkout) — unclear origin, worth checking/cleaning up at some point.

## Key lessons/conventions from this project's history

- Excel columns are 1-indexed, header is row 1 (mapping above). Off-by-one `getCell()`
  mistakes have corrupted the Status column twice — always verify against the header
  row before writing, and read back rows afterward to confirm alignment held.
- Computing the next S.No for new rows: use `ws.rowCount - 1` (rowCount includes the
  header) — an earlier bug used `ws.rowCount` directly and left a gap.
- Check for a `~$<filename>.xlsx` lock file before writing — the workbook may be open
  in Excel on the user's machine; don't force a write if it's locked.
- Known-failing/defect test cases should assert the CORRECT expected behavior (so they
  genuinely fail against the live bug) — never assert the buggy behavior just to make
  the test pass, which would hide the defect.
- `BrowserFactory`'s shared-session mode restarts the whole Playwright worker (and the
  shared browser with it) after ANY failing test — hard platform behavior, not a bug
  (confirmed via `node_modules/playwright/lib/runner/dispatcher.js:102`). Plan test
  ordering with this in mind if using shared sessions with known-failing tests mixed in.
- A blocked/failed "Next" click on the Candidate Application Form does NOT persist data
  server-side (confirmed live) — this is what makes reusing one test candidate account
  safe for negative/validation-style tests instead of signing up fresh every time.
- Keep optimizations/new capabilities strictly scoped: don't touch
  `utils/BrowserFactory.js`, `playwright.config.js`, `utils/globalTeardown.js`, or other
  modules' files while working on one module. Add new helpers alongside existing ones
  rather than restructuring them.
- The corporate network can intermittently block the test app with a content filter
  ("ContentKeeper") — if tests suddenly all start timing out together, check for a
  "Blocked by ContentKeeper" page before assuming it's an app or automation bug.
- Building automation for a module with this many test cases is genuinely time-consuming
  live (each test needs real browser/app interaction) — batch/verify incrementally
  rather than committing to one long uninterrupted run, and write Excel results for
  whatever's already confirmed rather than waiting for 100% completion.
- Fixed `hardWait(N)` sleeps between field interactions are a real, measured cost (they
  made up roughly half of Phase 1's suite runtime) — prefer waiting for an actual signal
  (e.g. `utils/MendixSettle.js`'s `settle()`, which waits for the DOM to stop mutating)
  over guessing a sleep duration, when introducing this pattern to a new module.
- When multiple flagged/ambiguous test cases share the same-shaped open question (e.g.
  several "live message wording differs from Excel" cases), don't resolve them all the
  same way just because the first one got resolved a certain way — ask about each one
  and apply only what's explicitly decided per case. See `feedback-per-case-decisions`
  memory.
- Don't propose or start deferred work unprompted — if the user has explicitly parked
  part of a module (e.g. "not Phase 2 right now"), leave it alone until they reopen it,
  even if a related change would technically touch shared code.
- Never apply cell colors/formatting to a Test Cases workbook — write values only. The
  user does all highlighting manually. See `feedback-no-excel-styling` memory.
- A test that only counts elements (e.g. "did a new block appear") rather than reading
  validation messages can badly misread the app: multiple "cap" defects in this project
  (Add Qualification, Add Experience) turned out to be the app correctly refusing to add
  a blank/incomplete block, not a limit — the count-only check made a refusal look
  identical to a real cap. Always check for validation messages before concluding a
  control is capped/disabled/broken.
- When a fix or new finding changes a defect's story after the row was already recorded,
  update ALL of Name/Description/Steps/Expected Result, not just Actual Result — a reader
  who only sees the Expected Result column should still get the accurate, current
  picture, not a stale one contradicted by a wall of text elsewhere in the row.
- A field that's normally located via its placeholder can lose that placeholder when the
  app disables it (seen on Experience Details' "To" date) — prefer a stable id-based
  locator over a placeholder/index-based one for any field that has a disabled state.
