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
  shared-session pattern (`{shared:true}` + `resetForNextTest()`). 1 test (TC_16, Report
  sheet) is Pending, deferred — "Initital feedback" data doesn't exist yet; documented
  in Actual with a `(Deferred - ...)` bracketed reason so it can be found again later.
- **Candidate Sign In & Sign Up** — 48 tests. `tests/Candidate/SignIn.spec.js` +
  `SignUp.spec.js`. Source: `Test Cases/candidateSignInSignUp.xlsx`. Also shared-session.
- **Candidate Application Form — Phase 1** — 119 tests, fully live-verified.
  `tests/Candidate/Phase1.spec.js`. Source: `Test Cases/Candidate Application Form.xlsx`,
  sheet `Phase1`. Result: 108 Passed / 11 Failed / 0 Pending — every failure is a
  documented, live-confirmed app defect with a Priority (P1-P3) in the workbook's 11th
  column ("Priority"), the user's own ruling per case, not inferred from similar ones.
  `pages/Candidate/Phase1.js` and the Phase-1-relevant parts of
  `utils/CandidateFlowHelpers.js` are SHARED with Phase 2 — stable, extended additively.
- **Candidate Application Form — Phase 2** — 96 tests, fully live-verified, both
  subsections ("1. Other Details" and "2. Upload Documents") done. `tests/Candidate/
  Phase2.spec.js` (rewritten from scratch 2026-09-25 — the pre-existing legacy suite
  there was set aside on the user's instruction). Source: same workbook, sheet `Phase2`.
  Result: 88 Passed / 6 Failed (all prioritized: TC_86 P1, TC_92 P2, TC_10/TC_35/TC_60/
  TC_74 P3) / 2 Pending (TC_49 — YouTube blocked on this network; TC_91 — drag-and-drop
  needs a CDP-level technique, deferred; both documented in Actual with a bracketed
  reason). New supporting files: `pages/Candidate/Phase2OtherDetails.js` (classes
  `ITAP_Phase2OtherDetailsPage` and `ITAP_Phase2UploadDocumentsPage` — kept separate from
  the legacy `pages/Candidate/Phase2.js`, which `CandidateFlowHelpers.js` and
  `createFreshInterviewCandidate.js` still use), `utils/Phase2TestCandidates.js` (the
  account pool, see below).
  **Account pool for Phase 2** (`utils/Phase2TestCandidates.js`) — reusable pooled
  accounts, all password `config.NewPassword`: `single`/`married`/`divorced`/`widowed`/
  `other` (Phase 1 done, vary by Marital Status), `fresher` (experienced=No, Other
  Details only), `fresherUploads` (experienced=No, already past a successful Other
  Details Next — reserved for Upload Documents), `deceasedDependent` (Father marked
  deceased — reserved for deceased-dependent checks only, incompatible with tests
  assuming 2 ordinary rows). CRITICAL: a **successful** Next on Other Details SAVES data
  permanently server-side and advances the account past Other Details (confirmed live)
  — never click a genuinely valid Next + Submit on `single`/`fresher`/`married`/`widowed`/
  `other`. `divorced` and `fresherUploads` already had this done deliberately (for TC_62
  and Upload Documents work respectively) and are safe to reuse for anything short of a
  real Submit. Any test needing an actual completed Submit (TC_89) MUST use a fresh,
  single-use, disposable account, created inline, never added to the pool, never reused.
  `utils/upload-files/` — moved from the project root into `utils/` (2026-09-28, user
  request); `CandidateFlowHelpers.js` and `createFreshInterviewCandidate.js` were updated
  to the new `__dirname`-based path. Has 2 valid files per document type (for the 2-file-
  cap tests), plus format/size/filename edge cases (`invalid-type.gif`, `exactly5mb.jpg`,
  `oversized.jpg`, `test.pdf`, `salarySlip.png`).

**Files off-limits** without being asked again: `tests/ManagerReferral/`,
`pages/ManagerReferral/`, `Test Cases/ManagerReferral_TestCases.xlsx`,
`tests/Candidate/SignIn.spec.js`, `tests/Candidate/SignUp.spec.js`,
`pages/Candidate/SignUpSignIn.js`, `Test Cases/candidateSignInSignUp.xlsx`,
`utils/SampleCandidate.js`, `tests/Candidate/Phase1.spec.js`,
`tests/Candidate/Phase2.spec.js`, `pages/Candidate/Phase2OtherDetails.js`,
`utils/Phase2TestCandidates.js`.

## Currently in progress / not yet started — will follow the same pattern as the completed modules above

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
- A **successful** Next (unlike a blocked one) DOES persist data server-side and
  permanently advances the account (confirmed live for Phase 2's Other Details → Upload
  Documents transition, and for a real Submit). Any test that needs this MUST run on a
  dedicated spare/disposable account, never a pooled account other tests still rely on.
- Mendix's file-upload widget (`filedropper` BEM classes: `.filedropper`,
  `.filedropper__dropzone`, `.filedropper__list`, `.filedropper__alerts`,
  `.filedropper__item`, `.filedropper__button-zone__button` for delete) does NOT sit
  directly next to its field's text label in the DOM — locating it via `nth(i)`
  positional indices is fragile because uploading a file can shift every later index
  (confirmed live: total file-input count changes as slots fill/empty). Climb from the
  label element to the nearest ancestor containing `.filedropper` instead (see
  `pages/Candidate/Phase2OtherDetails.js`'s `fieldContainer()`/`uploadInto()` and this
  session's own `labelToDropzoneHandle()` probe pattern) — stable regardless of DOM
  reordering. A `.filedropper` field caps at 2 files (Experience Documents: 10); once
  capped, its `<input type=file>` disappears entirely rather than showing an error.
- Playwright element handles can go stale mid-script when a Mendix widget re-renders
  after an interaction (e.g. a progress-bar animation completing) — a handle captured
  before that point throws "Element is not attached to the DOM" on the next action.
  Prefer doing the click *inside* a single `page.evaluate()`/`elementHandle.evaluate()`
  call (query + click in the same browser-side execution) over holding a Playwright
  handle across an `await` boundary.
- The "Click Here To See Document Upload Instructions" link does not fire a Playwright
  `download` event — it opens a new tab that navigates directly to a Mendix `/file?
  guid=...` URL (Chromium renders the PDF inline). To fetch it programmatically, capture
  that URL from the `page` popup event, then use `context.request.get(url)` (reuses the
  authenticated session's cookies) to get the raw bytes. `pdf-parse` (v2, added as a
  devDependency 2026-09-28) parses it: `new PDFParse({ data: buffer })`, then
  `.getText()` for per-page text and `.getImage()` for embedded image/screenshot counts.
- Simulating drag-and-drop file upload via synthetic DOM events (`dragenter`/`dragover`/
  `drop` with a manually-built `DataTransfer`) did NOT register on this React-based
  widget — likely needs a genuinely browser-trusted gesture (Chrome DevTools Protocol's
  `Input.dispatchDragEvent`), not yet implemented. Left as a known gap (see Phase 2's
  TC_91) rather than forcing an unreliable workaround.
- When documenting why a test case is Pending (blocked/deferred, not yet run), record
  the reason directly in the Actual column, right after "Not yet automated.", in a
  bracketed note — e.g. `Not yet automated. (Blocked: ...)` or `(Deferred: ...)` — so it
  can be found and revisited later once whatever's blocking it is resolved.
- **Standing convention (2026-09-28):** every Pending test case must ALSO have a real
  `test()` stub in its spec file using `test.skip(true, '<reason>')` — the inside-body
  form, not the `test.skip(title, body)` modifier — with the reason text matching
  Excel's bracketed note (drop the "Not yet automated." prefix, just the reason itself).
  `server.js`'s `finalizeRun` already reads `test.annotations[].description` for a
  skipped test and shows it in the dashboard's Reason column instead of a generic
  "Skipped (no reason given)"; Playwright's own native HTML report picks up the same
  annotation automatically, no separate work needed for that surface. See TC_16
  (`tests/ManagerReferral/Report.spec.js`), TC_49/TC_91
  (`tests/Candidate/Phase2.spec.js`) for the pattern. Do this at the same time a test is
  marked Pending, not as a later cleanup pass — keeps Excel and the dashboard/report
  from drifting out of sync.
- When estimated automation time looks too high, look for real ways to cut it before
  just accepting the estimate: pre-solve the genuinely novel technical pieces directly
  yourself (a few minutes of focused probing) rather than paying a full agent-delegation
  research tax for each one, recheck whether a "needs its own fresh account" test can
  actually be proven safely without completing the risky action (e.g. double-click-
  Submit only needs proving one dialog appears, not a real Yes), and combine tests that
  share the same setup into one continuous session instead of re-doing setup per test.

## Dashboard feature: email notification on run completion (added 2026-09-29)

An opt-in checkbox on the dashboard ("Email me when this run finishes", in the
per-module `header-actions` row, currently only wired to the single-module "Run All"
path — NOT yet wired to "Run Everything"/`/api/run-full-suite`, which itself isn't a
built feature yet per the user). When checked, its state flows through
`/api/run-tests`'s `notifyByEmail` body field → `startProjectRun()`'s 4th
parameter → stored on `currentRun.notifyByEmail` → read in `finalizeRun()` once the
run completes, which then (fire-and-forget, never blocking `run-complete`'s own
broadcast, and never able to affect the run's own recorded results — errors are
caught and only logged) renders and emails the report.

**Key design choice — don't reimplement the report logic, reuse it live:** rather than
porting `buildDownloadableReportHtml()` (automation-dashboard.html) and its whole
dependency chain (`assignCategoryIds`, `friendlyReason`, `classifyTest`, etc. — all
client-only) to Node, `renderReportToPdf()` in `server.js` launches a headless
Chromium (`playwright`'s `chromium`, already a project dependency), loads the real
running dashboard at `http://localhost:3000/automation-dashboard`, and calls
`buildDownloadableReportHtml()` directly via `page.evaluate()` to get the exact same
HTML the "Download Report" button would produce — then prints THAT to PDF via
`page.pdf()`. Zero duplicated logic, guaranteed always pixel-identical to what a human
downloading the report manually would see, no maintenance burden of keeping two copies
in sync.

**Email routing — confirmed live 2026-09-29, do not assume the "obvious" direction
works:** sender = personal Gmail (`PERSONAL_GMAIL_ADDRESS`/`PERSONAL_GMAIL_APP_PASSWORD`
in `.env`, an App Password from https://myaccount.google.com/apppasswords, requires
2-Step Verification), recipient = company email (`COMPANY_EMAIL_ADDRESS` in `.env`).
Sending FROM the company Outlook/365 account was tried FIRST (matching the user's
initial preference) and is a confirmed dead end — no "App passwords" option exists on
that account's Microsoft security-info page at all, meaning the org's IT has disabled
legacy/basic SMTP auth for the tenant; this cannot be fixed from the user's side, only
an Exchange admin could enable it. `verify-gmail-smtp.js` (kept, standalone, not part
of the real feature) is a quick sanity-check tool for this path if it ever needs
re-diagnosing later, independent of the full dashboard.

**Credentials:** `.env` (gitignored, real values only entered directly by the user in
their own editor — NEVER pasted into a Claude Code conversation, even by a trusted
user, since a chat message becomes part of the session transcript/log permanently in a
way a local file edit does not). `.env.example` (committed) is the template. Real `.env`
is never read by Claude Code either, by deliberate choice — the user verifies its
contents themselves via `Get-Content .env` / the IDE, and shares back only non-secret
confirmations (e.g. "the email address looks right") when troubleshooting.

**Known gotcha that cost real debugging time:** IDE edits to `.env` that aren't
explicitly saved (Ctrl+S) leave the on-disk file — and therefore whatever
`dotenv.config()` actually loads — showing stale/placeholder content, even though the
IDE's own buffer shows the "correct" typed values. Always confirm via `Get-Content
.env` (or equivalent) that the SAVED file has real values before assuming a credential
problem is anything deeper than an unsaved edit.
