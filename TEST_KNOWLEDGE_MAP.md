# Test Case Knowledge Map — FC Admin / Candidate Automation Suite

Built 2026-09-08 by full read-through of every `.spec.js` file, page object, and helper in this repo (no files modified). Covers **268 `test()` calls** (265 active + 3 permanently `test.skip`'d) across 15 spec files. Test counts were grep-verified per file, not estimated.

**Design note on Test IDs:** almost every test name already starts with a native ID inherited from the original Excel trackers in this repo (`TC-030`, `INT-24`, `ONB-DV-08`, `FCI-04`, `E05`, etc.). Those IDs are what you'll actually grep for in VS Code, so this document uses them as the "Test ID" everywhere instead of inventing a second, redundant numbering scheme. A handful of tests (3 in PreviewCandidateEmail.spec.js, all of Training.spec.js/OpenTraining.spec.js) have no native ID — those are identified by their exact name + file:line only.

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Test Suite Architecture](#2-test-suite-architecture)
3. [Master Test Case Inventory](#3-master-test-case-inventory)
4. [Feature/Module Map](#4-featuremodule-map)
5. [Boss Question → Test Case Lookup](#5-boss-question--test-case-lookup)
6. [Keyword/Synonym → Test Case Index](#6-keywordsynonym--test-case-index)
7. [Tier 1 / 2 / 3 Study Priorities](#7-tier-1--2--3-study-priorities)
8. [Feature-Level Cheat Sheets](#8-feature-level-cheat-sheets)
9. [Coverage Gaps / Duplicates / Concerns](#9-coverage-gaps--duplicates--concerns)
10. [How to Quickly Find Any Test in VS Code](#10-how-to-quickly-find-any-test-in-vs-code)
11. [30-Minute Study Plan](#11-30-minute-study-plan)
12. [1-Hour Study Plan](#12-1-hour-study-plan)
13. [2-Hour Study Plan](#13-2-hour-study-plan)
14. [Mock Manager Questions + Answers](#14-mock-manager-questions--answers)
15. [Final One-Page Revision Sheet](#15-final-one-page-revision-sheet)

---

## 1. Executive Summary

This is a Playwright/JS suite (Page Object Model) automating a Mendix-based HR/recruitment platform for Mankind Pharma, covering four business modules end-to-end:

1. **Candidate** — public signup, sign-in, and the two-phase application form (Personal/Qualification/Experience details, document upload). 48 tests.
2. **Interview** — FC Admin ("akshay.gupta") scheduling interviews, access control, the interview grid, feedback capture, final status, and the two outbound email-preview screens. 88 tests (55 root + 33 subfolder).
3. **Onboarding** — FC Admin's onboarding grid, HR's separate Document Verification portal, and Offer/Appointment/Apprentice letter generation. 121 tests (41 root + 80 subfolder).
4. **Training** — creating a training slot and assigning an interviewed candidate to a batch. 11 tests, explicitly flagged in the code itself as **"UNVERIFIED / NEEDS REWORK."**

**Overall maturity is uneven and the code says so out loud** — most files carry extensive comments admitting known bugs, documenting why a test is ordered where it is, or flagging a test as a non-functional placeholder. That honesty is an asset for you: the answer to "is this covered?" is very often already written down in a comment above the test.

**Headline items to know cold before a manager conversation:**
- There is a real, **unresolved contradiction in the repo right now**: `config.js` states in a comment that FC Admin user `akshay.gupta` has no sidebar access to Document Verification; project history says the opposite was observed live. **No automated test checks this either way.** (Section 9.)
- Two real production bugs were found and fixed by this automation project itself: an email-destination override missing from Interview's candidate-email flow (real leak to a candidate's personal Gmail), and Training's recipient field being hardcoded to a real colleague's inbox. The Interview fix is *applied* but not *assertion-verified*; the Training fix is verified even less (Section 9).
- The Training module has **zero `expect()` assertions** across all 11 tests — every "pass" only means "nothing threw an exception," not that behavior was verified. One test (`TC04`) is confirmed actually broken.
- Several tests are **deliberately red** (intentionally failing) because they assert the *correct* expected behavior against a known, still-open app bug — e.g. Candidate's `TC-019` (future interview dates wrongly accepted) and Interview Setup's `TC-036` (End Time before Start Time silently accepted). Don't mistake these for broken automation.

The skill this document is built to give you: **see a scenario → know the module → know the file → know the native ID → open the exact line.**

---

## 2. Test Suite Architecture

**Playwright config** (`playwright.config.js`): one project only (`chromium`; Firefox/WebKit are commented out). `fullyParallel: false`, `workers: 1`, `retries: 0` — tests run strictly sequentially, in file-declaration order, because many of them share browser/page state on purpose. `actionTimeout: 30000` was added deliberately (per its own comment) after a real incident where unbounded actions hung for the entire 120s test timeout. There is **no Playwright "projects" dependency graph** (`dependsOn`) — nothing enforces file execution order at the framework level; ordering safety is entirely hand-built into each file via `beforeAll`.

**Directory layout** mirrors 1:1 between tests and page objects:
```
tests/<Module>[/<SubFeature>].spec.js   ↔   pages/<Module>[/<SubFeature>].js
```
Every page object except `pages/OpenTraining.js` and `pages/Training.js` extends `pages/BasePage.js`, which supplies the common verbs used everywhere: `fill`, `click`, `waitForVisible`, `waitForPageLoad` (bounded, swallowed `networkidle` wait — Mendix keeps a persistent connection open so true `networkidle` can hang forever), `isVisible`, `getText`, `selectOption`, `count`, `getAllTexts`, `getAttribute`, `clickJS`, `scrollIntoView`. Training's two page objects call raw `page.locator`/`page.getByRole` directly instead — a genuine inconsistency, not a design choice, per the Training module's own "NEEDS REWORK" header.

**No native Playwright fixtures** (`test.extend`) are used anywhere. "Setup" is done manually: every spec's `beforeAll` builds a fresh `BrowserFactory` (`utils/BrowserFactory.js`), logs in, and constructs its own Page Object instances. `BrowserFactory` also applies `slowMo` (400ms in headed mode, 0ms headless) so a human watching a headed run can actually see each field being filled.

**Authentication is NOT unified** — there are four distinct login paths, each with its own credentials/page object:
- Candidate signup/sign-in (public portal) — `pages/Candidate/SignUpSignIn.js`.
- FC Admin login (`akshay.gupta`) — `pages/FCAdminLogin.js`'s `ITAP_Login`, explicitly shared by Interview and Onboarding grid tests.
- HR login (`nimisha`) — used only by Document Verification.
- Training/Open Training logins (`akshay.gupta` / `krati`) — each with their own inline `enterUsername`/`clickSignIn`-style methods, not reusing `ITAP_Login`.

**Test data sources:**
- `config.js` — hardcoded field defaults, credentials, URLs, and critically `EmailId` (`yuvraj.intern@mankindpharma.com`, the one safe inbox all automation email tests are supposed to redirect to) and `fieldCoordinatorName` (`"Akshay Gupta"`, the standing convention for Document Verification).
- `utils/CandidateFlowHelpers.js` — shared field-fillers for Candidate Phase1/Phase2 specs, plus `getRandomAadhar()` for per-test fresh signups.
- `utils/DailyCandidateNaming.js` — persists a per-day counter (`run-reports/dailyCandidateCounter.json`) so repeated same-day runs get sequential candidate names (`test01`, `test02`, …).
- Two tiers of test candidates: **recurring dummies** reused indefinitely for non-destructive modules (`"Demo User Alpha"`, ITAP `250347`/`250349`, `"Test Can"` rows) vs. a **fresh candidate every run** for the one genuinely one-way action in the whole suite, Document Verification (via `utils/createClearedOnboardingCandidate.js`).

**The cross-file glue helpers** (this is the backbone connecting modules):
- `utils/createFreshInterviewCandidate.js` — drives one candidate through signup → Phase 1 → Phase 2 submission and sets `utils/Globals.js`'s `ctx.itapNumber`. Used by every Interview subfolder spec's `beforeAll` that needs a guaranteed-fresh candidate.
- `utils/createClearedOnboardingCandidate.js` — builds on the above, then logs into FC Admin and schedules + emails the candidate, landing them in HR's "Verification Pending" queue. Used by `DocumentVerification.spec.js`.
- `utils/Globals.js` — a single mutable `{ itapNumber: null }`. This is the **only** true piece of cross-file global state in the project. It's written and read safely within the same `beforeAll` by the Interview helpers, but `Training.spec.js`'s `TC04`/`TC06` also read it assuming an earlier Interview-module run already populated it in the same process — with no null-guard (contrast `Interview/Setup.spec.js`, which explicitly throws if it's unset).

**How tests relate to each other:**
- Inside one `test.describe.serial(...)` block: all tests share **one** browser/page/login/candidate from a single `beforeAll` — later tests depend on state (filters, open dialogs, selected rows, form field values) left by earlier ones. This is the dominant pattern in Interview and Onboarding.
- Across different `describe` blocks in the same file: usually independent (separate `beforeAll` each).
- Across different spec **files**: designed to be independent of each other via fresh-candidate creation (an explicit 2026-09-02 fix, per multiple file headers, replacing an earlier "Run All" design that had cross-file cascading failures) — the one exception is Training's dependency on `Globals.ctx.itapNumber`.

**Execution & reporting**: `package.json` exposes one npm script per module (`npm run test:interview-setup`, etc.) plus `npm run dashboard`, which launches a bespoke, non-Playwright-native run dashboard (`server.js` + `automation-dashboard.html`) for selective/headless batch runs and a custom Excel report (`excelReporter.js`, called via `addResult`/`saveFile` inside `Interview.spec.js`/`Onboarding.spec.js`). Playwright's own HTML reporter also runs in parallel (`playwright-report/`).

---

## 3. Master Test Case Inventory

Organized by directory, matching how you'd navigate to them in VS Code. Every table below is the full, verified inventory for that file group — nothing was skipped. Priority/Category/Notes were assigned from a full read of the actual test code, not from names alone.

### 3.1 Candidate module — `tests/Candidate/Phase1.spec.js`, `Phase2.spec.js`, `SignUpSignIn.spec.js` (48 tests)

Page objects: `pages/Candidate/Phase1.js`, `Phase2.js`, `SignUpSignIn.js`. Helper: `utils/CandidateFlowHelpers.js`. No `test.describe.serial` anywhere in this module — every test signs up its own brand-new candidate via `getRandomAadhar()`, so these are the most independently-runnable tests in the whole suite (the one real exception is a group of Sign-In/Forgot-Password tests that assume `config.DuplicateTestAadhar` is already registered — see §9).

| # | Test Name (exact string) | File:Line | Describe Block | Category | Scenario | Precondition | Key Test Data | Expected Result | Priority |
|---|---|---|---|---|---|---|---|---|---|
| 1 | TC-015: blocks Next when mandatory fields are left blank | Phase1.spec.js:42 | Phase 1 - Personal Details - Negative & Edge Cases | Validation | Click Next on a fully blank Personal Details form | Fresh signup | none | ≥1 validation message | High |
| 2 | TC-016: rejects a malformed PAN number | Phase1.spec.js:54 | same | Validation | Submit with PAN="12345" | Fresh signup | pan='12345' | /pan/i message | Medium |
| 3 | TC-017: rejects a mobile number with the wrong digit count | Phase1.spec.js:65 | same | Validation | Submit with mobile="12345" | Fresh signup | mobile='12345' | /mobile/i message | Medium |
| 4 | TC-019: rejects a future "past interview date" | Phase1.spec.js:82 | same | Validation | Submit interviewDate=1/1/2099 | Fresh signup | interviewDate | **Deliberately failing** — app confirmed-live to accept it | Medium |
| 5 | TC-018: rejects an invalid PIN code | Phase1.spec.js:93 | same | Validation | Submit PIN="123" | Fresh signup | pin='123' | /pin/i message | Low |
| 6 | TC-020: rejects a malformed vehicle number | Phase1.spec.js:104 | same | Validation | Submit vehicleNumber="ABC" | Fresh signup | vehicleNumber | /vehicle/i message | Low |
| 7 | TC-021: browser refresh mid-form does not leave a broken/duplicated state | Phase1.spec.js:115 | same | Robustness | Fill First/Last name, reload page | Fresh signup | — | Title valid; ≤1 firstNamefield | Low |
| 8 | E01: PAN validation message appears immediately on blur, without clicking Next | Phase1.spec.js:134 | same | Validation | Malformed PAN then blur (no Submit) | Fresh signup | pan='12345' | Message appears without Next | Low |
| 9 | TC-022: rejects a 10th "To Date" earlier than its "From Date" | Phase1.spec.js:163 | Phase 1 - Qualification Details - Negative & Edge Cases | Validation | 10th To-Date before From-Date | Personal Details submitted | dates reversed | /date/i message | Medium |
| 10 | TC-023: rejects a marks percentage outside 0-100 | Phase1.spec.js:174 | same | Validation | xthMarks=150 | same | marks=150 | /marks\|percent/i | Medium |
| 11 | TC-024: allows adding more than one additional qualification | Phase1.spec.js:185 | same | Functional | Add 2 additional qualifications | same | — | 0 validation messages | Low |
| 12 | TC-025: rejects an experience "To Date" earlier than its "From Date" | Phase1.spec.js:222 | Phase 1 - Experience Details - Negative & Edge Cases | Validation | Reversed experience dates | Qualification submitted | dates reversed | /date/i message | Medium |
| 13 | TC-026: "Currently working here" checked together with an explicit To Date | Phase1.spec.js:232 | same | Validation/Robustness | Check box after ToDate filled | same | — | ToDate cleared OR message | Low |
| 14 | TC-027: switching Experienced -> Not Experienced after partial entry leaves no stale state | Phase1.spec.js:250 | same | Robustness/Functional | Fill company, switch to No | same | companyName | Field hidden; 0 messages | Low |
| 15 | TC-030: blocks Submit when a mandatory document is missing | Phase2.spec.js:131 | Phase 2 - Document Upload - Negative & Edge Cases | Validation | Skip PAN-card slot, submit | Full flow to uploads | skipIndices=[2] | "Application Submitted" count=0 | High |
| 16 | TC-028: rejects an unsupported file type on upload | Phase2.spec.js:145 | same | Validation | Upload .gif | same | invalid-type.gif | /is allowed/i popup | Medium |
| 17 | TC-031: rejects a malformed UAN number | Phase2.spec.js:159 | same | Validation | UAN="123" | same (stops at Other Details) | uan='123' | /uan/i message | Low |
| 18 | TC-029: rejects an oversized file on upload | Phase2.spec.js:169 | same | Validation | Upload oversized.jpg | same | oversized.jpg | /maximum file size/i | Low |
| 19 | TC-032: replacing an already-uploaded document keeps only the new file | Phase2.spec.js:182 | same | Functional | Upload Aadhar.jpg then Pancard.jpg into same slot | same | two files | Slot holds only latest file | Low |
| 20 | TC-012: rejects sign-in with an incorrect password | SignUpSignIn.spec.js:35 | Candidate Sign-In - Negative Cases | Negative | Registered Aadhaar, wrong password | Assumes DuplicateTestAadhar registered | — | Stays on Candidate Login | High |
| 21 | TC-013: rejects sign-in with an unregistered Aadhaar number | SignUpSignIn.spec.js:49 | same | Negative | Never-registered Aadhaar | Fresh browser | aadhar='888877776666' | Stays on Login | High |
| 22 | TC-014: safely rejects script/SQL-injection style input without executing it | SignUpSignIn.spec.js:60 | same | **Security** | `' OR 1=1--` / `<script>alert(1)</script>` | Fresh browser | injection strings | No JS dialog; "invalid Aadhaar" shown | High |
| 23 | TC-N11: blocks sign-in when the acknowledgement checkbox is left unchecked | SignUpSignIn.spec.js:81 | same | Validation/Security | Valid creds, checkbox unchecked | Assumes DuplicateTestAadhar | — | Stays on Login | High |
| 24 | E07: rapid double-click on Sign In does not cause a duplicate session or error | SignUpSignIn.spec.js:95 | same | Robustness | Two near-simultaneous clicks | Assumes DuplicateTestAadhar valid | — | Sign-in succeeds cleanly | Medium |
| 25 | Forgot Password: registered Aadhaar number receives a reset-link confirmation | SignUpSignIn.spec.js:132 | Candidate Sign-In - Forgot Password | Functional | Submit with known Aadhaar | Assumes DuplicateTestAadhar registered | — | "reset link has been sent" message | Medium |
| 26 | Forgot Password: unregistered Aadhaar number is told details are not available | SignUpSignIn.spec.js:146 | same | Negative | Unregistered Aadhaar | Fresh browser | — | "Details Not Available" | Medium |
| 27 | Forgot Password: blank Aadhaar number is rejected by field validation | SignUpSignIn.spec.js:157 | same | Validation | Blank submit | Fresh browser | — | "Enter Valid Aadhaar Number" | Medium |
| 28 | TC-001/002: rejects a non-numeric or short Aadhaar number | SignUpSignIn.spec.js:190 | Candidate Signup - Negative & Edge Cases | Validation | Aadhaar="abc" | Signup modal open | — | "Enter Valid Aadhaar Number" | High |
| 29 | TC-003: rejects signup with an already-registered Aadhaar number | SignUpSignIn.spec.js:198 | same | Negative/Regression | Sign up twice, same Aadhaar | Self-contained | DuplicateTestAadhar | 2nd attempt doesn't reach Phase 1 | High |
| 30 | TC-004: rejects an invalid / official Mankind email address | SignUpSignIn.spec.js:231 | same | Validation | Malformed + official-domain email | Signup open | 2 emails | 2 distinct messages | High |
| 31 | TC-005: rejects mismatched New Password / Confirm Password | SignUpSignIn.spec.js:253 | same | Validation | Different passwords | Signup open | — | "must be same" message | High |
| 32 | TC-006: shows the password policy tooltip and enforces it | SignUpSignIn.spec.js:262 | same | Validation/Functional | Read tooltip, submit weak pw | Signup open | pw='abc' | Tooltip content; weak pw blocked | High |
| 33 | TC-007: rejects an invalid Manager Reference ID | SignUpSignIn.spec.js:281 | same | Validation | Wrong Manager Ref ID | Signup open | '99999999' | Specific error message | Medium |
| 34 | TC-008: blocks submission when the acknowledgement checkbox is unchecked | SignUpSignIn.spec.js:293 | same | Validation/Security | Fully valid form, checkbox off | Signup open | — | Blocked **silently**, no message | High |
| 35 | TC-009: shows per-field validation on a fully blank form submit | SignUpSignIn.spec.js:309 | same | Validation | Blank submit | Signup open | — | 4 field messages | High |
| 36 | TC-010: toggles between Sign Up and Sign In modals | SignUpSignIn.spec.js:321 | same | Functional | Toggle modal | Signup open | — | Sign-In field visible | Medium |
| 37 | TC-011: closing the Signup modal mid-entry and reopening it clears the form | SignUpSignIn.spec.js:333 | same | Functional | Partial entry, close, reopen | Signup open | — | Field cleared | Medium |
| 38 | E01: Aadhaar Number field enforces the 12-digit maximum length on both forms | SignUpSignIn.spec.js:344 | same | Validation/Robustness | Type 15 digits | Signup open | — | Truncated to 12 | Medium |
| 39 | E02: Manager Reference ID field enforces the 8-character maximum length | SignUpSignIn.spec.js:358 | same | Validation | Type 12 chars | Signup open | — | Truncated to 8 | Low |
| 40 | E03: Email field accepts up to its 200-character maximum length | SignUpSignIn.spec.js:364 | same | Validation | Type 202 chars | Signup open | — | Truncated to 200 | Low |
| 41 | E04: Password / Confirm Password fields enforce their 50-character maximum | SignUpSignIn.spec.js:373 | same | Validation | Type 60 chars | Signup open | — | Truncated to 50 | Low |
| 42 | E05: leading whitespace in Aadhaar Number is not trimmed and silently truncates the real digits | SignUpSignIn.spec.js:382 | same | Negative/Robustness | Aadhaar with leading/trailing spaces | Signup open | padded aadhar | Spaces kept, digits lost | Medium |
| 43 | E06: rapid double-click on Sign Up does not break the flow or leave a broken UI state | SignUpSignIn.spec.js:394 | same | Robustness | Two near-simultaneous clicks | Signup open | — | Lands cleanly on Phase 1 | Medium |
| 44 | E08: browser refresh while the Signup modal is open does not leave a broken state | SignUpSignIn.spec.js:419 | same | Robustness | Partial fill, reload | Signup open | — | Clean Login page | Low |
| 45 | E10: pasting a value longer than maxlength into Aadhaar Number is still truncated | SignUpSignIn.spec.js:430 | same | Validation/Robustness | Paste 20 digits | Signup open | — | Truncated to 12 | Low |
| 46 | E11: repeatedly toggling between Sign Up and Sign In does not stack modals or leak data | SignUpSignIn.spec.js:443 | same | Robustness | Toggle x3 | Signup open | — | Exactly 1 dialog; cleared field | Low |
| 47 | P08: sign in succeeds immediately after a fresh sign-up, using the same credentials | SignUpSignIn.spec.js:461 | Candidate Signup - Positive Follow-up | **Functional/Smoke** | Full signup, then sign in fresh | Self-contained | random Aadhaar | Both succeed | **Critical** |
| 48 | E09: concurrent sign-up attempts with the same Aadhaar Number only let one succeed | SignUpSignIn.spec.js:498 | Candidate Signup - Concurrency | Robustness/Security | Two sessions, same Aadhaar | Self-contained | shared Aadhaar | Exactly 1 of 2 succeeds | High |

### 3.2 Interview module (root) — `tests/Interview.spec.js` (55 tests)

Page objects: `pages/Interview.js` (`ITAP_InterviewGrid`, `ITAP_ReScheduleInterview`), `pages/FCAdminLogin.js`. This is the older, not-fully-split file — it retains Re-Schedule, Access Control, Login, and Grid Structure/Filters; everything else Interview-related moved to `tests/Interview/`.

| # | Test Name (exact string) | File:Line | Describe Block | Category | Scenario | Precondition | Expected Result | Priority |
|---|---|---|---|---|---|---|---|---|
| 1 | INT-24 [Negative]: Re-Schedule button, unlike Schedule Interview, is always enabled regardless of row selection | :51 | FC Admin - Re-Schedule Interview | Negative/Regression | Confirms button never disables | "Test Can" rows exist | Always `pointer-events: auto` | High |
| 2 | INT-25 [Negative]: Search by Candidate mode never lets Apply succeed, even for an eligible candidate | :70 | same | Negative | "Search by Candidate" mode | "Test Can" row | Mandatory-fields error every time | High |
| 3 | INT-64 [Negative]: Re-Schedule reuses the same past-date validation as Schedule Interview | :97 | same | Validation | Past date in reschedule panel | Needs a live Scheduled round | "Please Select Future Date" | Medium |
| 4 | INT-26 [Positive]: Cancel discards the reschedule attempt without altering the original round | :123 | same | Functional/Regression | Cancel reschedule | Needs a live Scheduled round | Round unchanged | High |
| 5 | INT-65 [Edge]: Batch-reschedule reordering controls are present even with a single candidate in the slot | :147 | same | Robustness | Move Up/Down on single row | Needs a live Scheduled round | Controls visible | Low |
| 6 | INT-72 [Positive]: A user with proper Appointment access reaches the Interview tab | :203 | FC Admin - Interview Access Control | **Security** | Full-access login | Fresh login (akshay.gupta) | Reaches Interview tab | **Critical** |
| 7 | FCI-04 [Negative]: A restricted-role user does not get proper Appointment access | :219 | same | **Security** | Restricted login ("Kanika") | Fresh login | No "Appointment" in sidebar | **Critical** |
| 8 | INT-48 [Positive]: Valid login lands on the FC Admin home view with full sidebar | :266 | FC Admin - Login | Smoke | Valid creds | none | Full sidebar shown | **Critical** |
| 9 | TC-040 [Negative]: FC Admin login with invalid credentials shows a clear error | :297 | same | Security/Negative | Bad creds | none | Clear error, stays on login | High |
| 10 | INT-49 [Edge]: Username field with leading/trailing whitespace is not trimmed | :316 | same | Negative/Robustness | Padded correct username | none | Same generic error (documents a UX gap) | Medium |
| 11 | INT-50 [Edge]: (not automatable) Session idle timeout while on the Interview grid | :344 | same | Robustness | — | — | **Always `test.skip`'d** | Low |
| 12 | INT-75 [Positive]: Browser tab title and page header both read "Appointment" | :393 | FC Admin - Interview Grid: Page Structure & Filters | Smoke | — | Grid loaded | Both = "Appointment" | Medium |
| 13 | INT-76 [Positive]: Logged-in user's name displays correctly | :398 | same | Functional | — | Grid loaded | Non-empty, no "undefined" | Low |
| 14 | INT-77 [Positive]: Company logo displays in the sidebar | :404 | same | Functional | — | Grid loaded | Logo visible | Low |
| 15 | INT-78 [Positive]: Sidebar shows the expected navigation items for a full-access role | :408 | same | Functional | — | Grid loaded | Items present | Medium |
| 16 | INT-87 [Negative]: (documented) restricted-role sidebar excludes Appointment entirely | :415 | same | Security/Negative | — | — | **`expect(true).toBe(true)` — no live check** | Medium |
| 17 | INT-79 [Positive]: "Appointment" sidebar item shows as visually highlighted | :426 | same | Functional | — | Grid loaded | Background differs | Low |
| 18 | INT-80 [Positive]: Interview/Training/Onboarding tabs present, Interview active by default | :433 | same | Smoke/Functional | — | Grid loaded | Tab order + active tab | Medium |
| 19 | INT-81 [Positive]: "Actionable Items" badge is visible and shows a numeric count | :439 | same | Functional | — | Grid loaded | Count ≥ 0 | Low |
| 20 | INT-82 [Positive]: All four action buttons are present | :445 | same | Smoke/Functional | — | Grid loaded | All 4 visible | Medium |
| 21 | INT-83 [Positive]: Grid shows all 12 expected column headers in order | :453 | same | **Regression** | — | Grid loaded | Exact header order | High |
| 22 | INT-84 [Positive]: Each column's filter control matches its data type | :462 | same | Validation | — | Grid loaded | Correct control types | Medium |
| 23 | INT-88 [Negative]: Empty/null field values render blank, not "null"/"undefined" | :472 | same | Robustness/Negative | — | Grid loaded | No literal null/undefined text | Medium |
| 24 | INT-85 [Positive]: Each grid row shows chevron, checkbox, edit, and refresh icons | :478 | same | Functional | — | Grid loaded | All 4 icons | Medium |
| 25 | INT-86 [Positive]: Pagination shows an accurate "X to Y of Z" range | :486 | same | Functional | — | Grid loaded | Regex match | Low |
| 26 | INT-90 [Edge]: Sidebar collapse/expand does not break the header layout | :491 | same | Robustness | — | Grid loaded | Header stays visible | Low |
| 27 | INT-91 [Edge]: Candidate Name column supports overflow handling for long values | :500 | same | Robustness | — | Grid loaded | Overflow CSS present | Low |
| 28 | INT-92 [Edge]: Narrow browser width keeps action buttons reachable | :510 | same | Robustness | — | Grid loaded | Button visible at 480x800 | Low |
| 29 | INT-89 [Negative]: Page does not silently blank out if Appointment data fails to load | :518 | same | Robustness/Negative | — | Separate page2, blocked route | Shell still shows | Medium |
| 30 | INT-04 [Negative]: Schedule/Re-Schedule buttons enable only once a row is selected | :538 | same | Validation | — | "Test Can" rows | Disabled → enabled | High |
| 31 | INT-03 [Positive]: Row chevron opens the Interview rounds detail dialog | :553 | same | Functional | — | "Test Can" rows | Dialog opens | Medium |
| 32 | INT-05 [Positive]: Edit icon opens the Candidate Status popup | :561 | same | Functional | — | "Test Can" rows | Dialog opens/closes | Medium |
| 33 | INT-06 [Negative]: Application-count icon requires confirmation before mutating data | :570 | same | Validation/Robustness | — | "Test Can" rows | Confirmation required, always Cancel | High |
| 34 | INT-51 [Negative]: Filtering to a non-matching name shows empty grid, not an error | :581 | same | Negative | — | Grid loaded | 0 rows, no error | Medium |
| 35 | INT-52 [Edge]: Row selection persists across pagination | :589 | same | Robustness | — | Grid loaded | Records boolean only (weak) | Low |
| 36 | INT-53 [Edge]: No header "select all" checkbox exists on this grid | :607 | same | Regression | — | Grid loaded | Count=0 | Low |
| 37 | INT-13 [Positive]: Export To Excel reflects the currently filtered grid | :616 | same | Functional | — | "Test Can" filtered | Valid filename | Medium |
| 38 | INT-73 [Negative]: Export triggered right after filtering does not error | :623 | same | Robustness/Negative | — | "Test Can" filtered | No error dialog | Medium |
| 39 | INT-58 [Edge]: Exporting the full unfiltered actionable list completes without erroring | :632 | same | Robustness | — | Grid loaded | Filename non-empty | Medium |
| 40 | INT-14 [Positive]: Feedbacks Export does not error for a candidate with no feedback | :637 | same | Functional/Negative | — | "Test Can" rows | No error | Low |
| 41 | INT-15 [Edge]: Export with zero filtered rows does not crash | :648 | same | Robustness | — | Nonsense filter | No error | Medium |
| 42 | INT-07 [Positive]: Reg ID filter returns matching rows | :659 | same | Functional/Regression | — | Reg ID read live | Fewer rows than unfiltered | High |
| 43 | TC-038 [Negative]: Search for a non-existent Reg ID shows empty grid, not an error | :679 | same | Negative | — | Grid loaded | 0 rows, no error | Medium |
| 44 | INT-08 [Positive]: Candidate Name filter is case-insensitive and matches partial text | :688 | same | Validation | — | "Test Can" rows | Same count both cases | Medium |
| 45 | INT-09 [Positive]: Dropdown filters expose the expected real option lists | :699 | same | Regression | — | Grid loaded | Expected option sets | Medium |
| 46 | INT-57 [Edge]: Current Round filter accepts its maximum real value (5) | :705 | same | Validation | — | Grid loaded | Option exists, no error | Medium |
| 47 | INT-10 [Positive]: Current Round Date filter is present and interactable | :718 | same | Functional | — | Grid loaded | Input visible | Low |
| 48 | INT-11 [Positive]: Application Count numeric filter accepts an exact value | :722 | same | Validation | — | Grid loaded | Value retained | Low |
| 49 | INT-56 [Edge]: Negative number in Application Count filter does not error | :728 | same | Negative/Robustness | — | Grid loaded | No error | Medium |
| 50 | INT-12 [Positive]: Clearing filters restores the full candidate list | :735 | same | Functional | — | "Test Can" filtered | Count restored | High |
| 51 | INT-54 [Negative]: Script/SQL-injection style text in filters is treated as plain text | :745 | same | **Security** | — | Grid loaded | No script/SQL execution | High |
| 52 | INT-55 [Edge]: Leading/trailing whitespace in Name filter does not silently break the match | :757 | same | Robustness/Negative | — | "Test Can" rows | Weak assertion, only records annotation | Medium |
| 53 | TC-039 [Negative]: Attempt to double-book an already-scheduled candidate | :781 | same | Negative/Validation | — | Needs a live Scheduled round (`test.skip` otherwise) | "cannot be set" error | High |
| 54 | INT-32 [Positive]: Status icon opens the Candidate Status popup with all expected controls | :811 | same | Functional | — | "Test Can" rows | Toggle/dropdown/remarks present | Medium |
| 55 | INT-34 [Edge]: Remarks field rejects/truncates input beyond its maximum length | :823 | same | Validation | — | "Test Can" rows | maxlength=200 enforced | Medium |

### 3.3 Interview subfolder — `tests/Interview/Setup.spec.js`, `StatusFeedback.spec.js`, `PreviewCandidateEmail.spec.js`, `PreviewInterviewerEmail.spec.js` (33 tests)

Each spec file's `beforeAll` calls `utils/createFreshInterviewCandidate.js` independently — no cross-file dependency. Page objects: `pages/Interview/Setup.js`, `StatusFeedback.js`, `PreviewCandidateEmail.js`, `PreviewInterviewerEmail.js`.

| # | Test Name (exact string) | File:Line | Describe Block | Category | Scenario | Expected Result | Priority |
|---|---|---|---|---|---|---|---|
| 1 | INT-18 [Positive]: Interviewer field only suggests valid (non-empty) interviewers | Setup.spec.js:97 | Schedule Interview Form Validation | Functional | Check combobox suggestions | All non-empty | Medium |
| 2 | INT-59 [Negative]: Interviewer selected but Start Date left blank shows mandatory-fields error | Setup.spec.js:107 | same | Validation | Allocate w/ blank date | Mandatory-fields error | High |
| 3 | INT-21 [Negative]: Allocate blocked when every field is left blank | Setup.spec.js:117 | same | Validation | Allocate, all blank | Error again | High |
| 4 | TC-037 [Negative]: Past Start Date shows "Please Select Future Date" inline | Setup.spec.js:131 | same | Validation | Date=01/01/2020 | Inline future-date message | Medium |
| 5 | INT-61 [Edge]: Start Date set to exactly today | Setup.spec.js:140 | same | Robustness | Date=today | Outcome-agnostic, documented | Low |
| 6 | INT-60 [Edge]: Selecting the maximum available Duration value is accepted | Setup.spec.js:159 | same | Robustness | Max Duration option | Accepted | Medium |
| 7 | TC-036 [Negative]: End Time earlier than Start Time is rejected or not silently accepted | Setup.spec.js:170 | same | Negative | Late Start + early End | **Deliberately failing** — app silently no-ops | Medium |
| 8 | Cleanup: Cancel out of the Schedule Interview screen without submitting | Setup.spec.js:226 | same | Functional | Cancel | No assertions (teardown) | Low |
| 9 | FCI-01 [Positive]: Schedule interviews for multiple candidates in one submission | Setup.spec.js:306 | Multi-Candidate Batch Scheduling | Functional | 2-candidate batch, both emails | Both rows show Scheduled | **Critical** |
| 10 | FCI-02 [Negative]: Selecting an eligible candidate together with an ineligible one blocks the whole batch | Setup.spec.js:360 | same | Negative | Fresh + ineligible ITAP 250303 | "cannot be set" error | High |
| 11 | INT-63 [Edge]: Move Up / Move Down are disabled with only one candidate in the batch | Setup.spec.js:429 | Schedule Interview Edge Cases | Robustness | 1-candidate batch | Buttons disabled | Low |
| 12 | INT-62 [Negative]: Removing every candidate from the batch does not block Submit & Preview at the UI level | Setup.spec.js:443 | same | Negative | Delete only row, Submit | Confirm popup still appears (UI gap) | Medium |
| 13 | INT-23 [Positive]: Cancelling out of the Schedule Interview screen discards changes | Setup.spec.js:472 | same | Functional | Cancel after selecting interviewer | Candidate stays Not Scheduled | Medium |
| 14 | INT-69 [Negative]: Evaluation score outside the valid range is rejected | StatusFeedback.spec.js:120 | Feedback Capture Validation | Validation | Score=15 | "Only 0-10" message | Medium |
| 15 | INT-70 [Edge]: Evaluation score is accepted at exact valid boundaries (0 and 10) | StatusFeedback.spec.js:162 | same | Robustness | Scores 10/0 | Success popup | Medium |
| 16 | INT-42 [Negative]: Duplicate feedback submission for the same round is prevented or flagged | StatusFeedback.spec.js:185 | same | Negative | Re-attempt feedback | **No `expect()` — can't fail** | Low |
| 17 | TC-043 [Positive]: Final status = Rejected is accepted | StatusFeedback.spec.js:315 | Final Status Validation (Rejected path) | Functional | Final Status=Rejected | Grid shows "Rejected" | **Critical** |
| 18 | INT-45 [Negative]: (documented finding) No rejection reason field exists when Final Status = Rejected | StatusFeedback.spec.js:336 | same | Negative | Check for reason field | None found | Medium |
| 19 | INT-33 [Negative]: Turning "Next Round Required" OFF requires a Final Status | StatusFeedback.spec.js:410 | Candidate Status Update | Validation | Toggle off, no Final Status | Blocked, inline error | High |
| 20 | INT-35 [Negative]: Save Changes blocked when a required field is missing | StatusFeedback.spec.js:431 | same | Validation | Same + grid-unchanged check | Blocked; row unchanged | High |
| 21 | TC-042 [Positive]: "Next Round Required" = ON path leaves Final Status not required | StatusFeedback.spec.js:450 | same | Functional | Toggle off then on | Final Status disables again | Medium |
| 22 | INT-68 [Edge]: Remarks field accepts exactly its maximum length and persists it | StatusFeedback.spec.js:475 | same | Robustness | 200 chars, save, reopen | Exact persistence | Medium |
| 23 | INT-36 [Positive]: Saving status updates the grid immediately | StatusFeedback.spec.js:496 | same | Functional | Final Status=Cleared (real save) | Grid reflects Cleared | **Critical** |
| 24 | INT-29 [Positive]: Preview Candidate Email tab allows editing CC and requires confirmation to send | PreviewCandidateEmail.spec.js:92 | Preview Candidate Email Validation | **Security** | Override To, clear CC | Runs w/o error — **no `toHaveValue` assertion** | High |
| 25 | FC Admin: Scroll and click Send Email to Candidates | PreviewCandidateEmail.spec.js:105 | same | Functional | Click Send | No assertions | Critical |
| 26 | FC Admin: Confirm sending email to candidates | PreviewCandidateEmail.spec.js:110 | same | Functional | Confirm Yes (real send) | Email sent | Critical |
| 27 | FC Admin: Click OK on email success popup | PreviewCandidateEmail.spec.js:115 | same | Functional | Dismiss popup | Popup gone | Medium |
| 28 | INT-31 [Positive]: After sending both emails, user is redirected back to the Interview tab | PreviewCandidateEmail.spec.js:120 | same | Functional | — | Interview tab visible | Medium |
| 29 | INT-27 [Positive]: Preview Interviewer Email tab shows correct, editable To/CC fields | PreviewInterviewerEmail.spec.js:76 | Preview Interviewer Email Validation | **Security** | Override To | **`toHaveValue(config.EmailId)` asserted** | High |
| 30 | INT-30 [Negative]: Invalid/empty "To" email does not block reaching the send confirmation | PreviewInterviewerEmail.spec.js:92 | same | Negative | Empty To, Send, decline | Confirm dialog still shows (documents a gap) | Medium |
| 31 | INT-66 [Negative]: A malformed address mixed into CC does not block reaching the send confirmation | PreviewInterviewerEmail.spec.js:108 | same | Negative | Malformed CC, decline | Same gap documented | Medium |
| 32 | INT-67 [Negative]: Declining the send-confirmation popup does not send the email | PreviewInterviewerEmail.spec.js:127 | same | **Security** | Decline send | To field re-verified = config.EmailId | High |
| 33 | INT-28 [Positive]: Sending interviewer email requires confirmation and shows success | PreviewInterviewerEmail.spec.js:137 | same | Functional | Real send | Success | **Critical** |

### 3.4 Onboarding module (root) — `tests/Onboarding.spec.js` (41 tests)

Page object: `pages/Onboarding.js` (`ITAP_OnboardingGrid`). Login as `akshay.gupta`. Two `describe.serial` blocks.

| # | Test Name (exact string) | File:Line | Describe Block | Category | Scenario | Expected Result | Priority |
|---|---|---|---|---|---|---|---|
| 1 | ONB-040 [Positive]: Clicking a row's Document Status icon opens the "Candidate Document Status" modal | :63 | Document Status Popup | Smoke | Click icon | Modal opens | **Critical** |
| 2 | ONB-041 [Positive]: Modal shows the correct Candidate Name, Division, and Role for the selected row | :69 | same | Functional | Reads open dialog | Summary matches row | High |
| 3 | ONB-042 [Edge]: HR Remarks textarea can retain a value entered in a previous session | :78 | same | Robustness | Read persisted Remarks | Self-skip or non-empty | Medium |
| 4 | ONB-043 [Positive]: Document table shows the expected columns | :98 | same | Functional | Check headers | 3 headers present | High |
| 5 | ONB-044 [Edge]: (not executed - would mutate shared data) closing without saving discards an HR Remarks edit | :116 | same | Robustness | Close popup | dialog count=0 (no actual edit performed) | Medium |
| 6 | ONB-069 [Edge]: Verified Status is read-only in the FC Admin Document Status popup | :131 | same | **Security** | Check for `<input>` in doc rows | None found | High |
| 7 | ONB-005 [Positive]: Onboarding tab is present and becomes active on click | :216 | Page Structure, Grid & Filters | Smoke | — | Active tab correct | **Critical** |
| 8 | ONB-006 [Positive]: "Actionable Items" badge is visible and shows a numeric count | :222 | same | Smoke | — | Count ≥0 | Medium |
| 9 | ONB-007 [Positive]: Gen Offer/Appointment/Apprentice Letter, Export buttons are present | :228 | same | Smoke | — | All 4 visible | **Critical** |
| 10 | ONB-008 [Edge]: A different division/permission context can show additional buttons | :236 | same | Functional | Static HTML comparison | Documents extra buttons | Medium |
| 11 | ONB-009 [Positive]: Grid displays all 20 expected columns in order | :263 | same | **Smoke/Regression** | — | Exact 20-column match | **Critical** |
| 12 | ONB-010 [Edge]: (documented, not re-verified live) column set can vary by the logged-in user's division context | :273 | same | Functional | — | **`expect(true).toBe(true)`** | Low |
| 13 | ONB-011 [Positive]: Each row has a working selection checkbox | :295 | same | Functional | — | Toggles | Medium |
| 14 | ONB-012 [Edge]: Reg ID and Candidate Name columns carry the freeze-columns class | :303 | same | Functional | — | Class present | Low |
| 15 | ONB-013 [Positive]: Columns with no data render as blank, not "null"/"undefined" | :313 | same | Regression | — | No literal null/undefined | Medium |
| 16 | ONB-014 [Positive]: Pagination control shows "X to Y of Z" and page-navigation arrows | :321 | same | Functional | — | Regex match | Medium |
| 17 | ONB-015 [Positive]: Document Status column shows a checkmark icon for at least one row | :328 | same | Functional | filterByName Demo | ≥1 icon | Medium |
| 18 | ONB-016 [Positive]: App. Letter column renders | :345 | same | Functional | — | cells exist | Low |
| 19 | ONB-017 [Positive]: Reg ID text filter narrows to an exact-match row | :361 | same | Functional | Live-read Reg ID | count=1 | High |
| 20 | ONB-018 [Positive]: Candidate Name text filter supports partial matching | :376 | same | Functional | filter "Demo" | All contain "Demo" | Medium |
| 21 | ONB-019 [Positive]: Role dropdown filter offers exactly two options | :385 | same | Functional | — | Exact set | Medium |
| 22 | ONB-020 [Positive]: Division dropdown filter offers all 5 configured divisions | :390 | same | Functional | — | Exact set | Medium |
| 23 | ONB-021 [Edge]: Preference HQ text filter narrows by partial text match | :397 | same | Robustness | Dynamic read | Self-skip or match | Medium |
| 24 | ONB-022 [Edge]: Training Date date-picker filter narrows to a specific date | :413 | same | Robustness | Dynamic read | Self-skip or match | Medium |
| 25 | ONB-023 [Positive]: Final Status dropdown filter offers exactly two options | :431 | same | Functional | — | Exact set | Medium |
| 26 | ONB-024 [Positive]: Document Status dropdown filter offers exactly two options | :436 | same | Functional | — | Exact set | Medium |
| 27 | ONB-025 [Positive]: Visiting Card dropdown filter offers Yes/No | :441 | same | Functional | — | Exact set | Low |
| 28 | ONB-026 [Positive]: Offer Letter dropdown filter offers Yes/No and "Yes" reflects real backend state | :446 | same | Functional | — | Options match (real check unenforced) | Medium |
| 29 | ONB-027 [Positive]: Designation dropdown filter offers the full company-wide designation master list | :463 | same | Functional | — | >50 options | Low |
| 30 | ONB-028 [Edge]: DOJ date-picker filter narrows to a specific date | :468 | same | Robustness | Dynamic read | Self-skip or match | Medium |
| 31 | ONB-029 [Positive]: HQ dropdown filter offers the full company location master list | :486 | same | Functional | — | >50 options | Low |
| 32 | ONB-030 [Edge]: Salary number filter narrows by exact numeric match | :491 | same | Robustness | Dynamic read | Self-skip or match | Medium |
| 33 | ONB-031 [Positive]: App. Letter dropdown filter offers Yes/No | :511 | same | Functional | — | Exact set | Low |
| 34 | ONB-032 [Edge]: ExtendedDOJ date-picker filter narrows to a specific date | :516 | same | Robustness | Full-pagination scan | Self-skip or match | Medium |
| 35 | ONB-033 [Positive]: DOJ Ext. Letter dropdown filter offers Yes/No | :536 | same | Functional | — | Exact set | Low |
| 36 | ONB-034 [Positive]: Joined dropdown filter offers Yes/No | :541 | same | Functional | — | Exact set | Low |
| 37 | ONB-035 [Edge]: Employee ID text filter narrows by exact match | :546 | same | Robustness | Full-pagination scan | count=1 | Medium |
| 38 | ONB-036 [Positive]: SF Integration Status dropdown filter offers exactly two options | :563 | same | Functional | — | Exact set | Medium |
| 39 | ONB-037 [Positive]: Clearing a filter restores the full unfiltered grid | :568 | same | **Regression** | filter+clear | Count round-trips | **Critical** |
| 40 | ONB-038 [Edge]: A leftover filter does not silently narrow a later unrelated check | :578 | same | **Regression** | Leave filter, unrelated read | Correct behavior confirmed | High |
| 41 | ONB-039 [Positive]: Export To Excel produces a real file download | :593 | same | Functional | — | Filename valid | Medium |

### 3.5 Onboarding subfolder — `GenAppointmentLetter.spec.js`, `GenApprenticeLetter.spec.js`, `GenOfferLetter.spec.js`, and `tests/HR/DocumentVerification.spec.js` (80 tests)

This is the largest and most security/robustness-conscious part of the suite.
DocumentVerification.spec.js moved out of tests/Onboarding/ into its own
tests/HR/ module (2026-09-08) — it's a distinct HR-only portal, not FC Admin —
but is still covered here alongside the rest of this originally-combined group.

**DocumentVerification.spec.js** (35 tests, HR login `nimisha`, two `describe.serial` blocks — main chain + separate Robustness & Security chain):

| Test Name (exact string) | Line | Category | Scenario | Expected Result | Priority |
|---|---|---|---|---|---|
| ONB-DV-01 [Positive]: HR account has a dedicated Document Verification sidebar item | 67 | Smoke | HR login → title check | Correct title | Medium |
| ONB-DV-02 [Positive]: Verification Pending / Verification Completed tabs are both present | 71 | Functional | — | Both tabs present | Medium |
| ONB-DV-15 [Positive]: Verification Pending grid shows the expected 5 columns plus a checkbox column | 76 | Functional | — | Headers match | Medium |
| ONB-DV-16 [Positive]: Verification Completed grid has an extra "Document Verification Date" column | 82 | Functional | — | Extra column present | Medium |
| ONB-DV-17 [Positive]: Division column filter is a free-text partial-match filter, not a dropdown | 88 | Functional | — | Confirms text input | Medium |
| ONB-DV-18 [Positive]: Candidate Name column filter supports partial matching | 110 | Functional | — | Count decreases | Medium |
| ONB-DV-19 [Positive]: Candidate Status dropdown filter on Verification Pending offers exactly 2 options | 120 | Validation | — | Exact 2 options | Medium |
| ONB-DV-20 [Positive]: Training Date / Document Verification Date filters are real date-picker widgets | 126 | Functional | — | Confirmed | Low |
| ONB-DV-21 [Positive]: Clearing a text filter restores the full unfiltered grid count | 134 | Functional | — | Count restored | Medium |
| ONB-DV-22 [Edge]: ITAP Number filter narrows the grid to a single exact-match row | 143 | Functional | — | count=1 | Medium |
| ONB-DV-26 [Positive]: Pagination controls page through results and update boundary button states | 154 | Functional | — | State toggles | Medium |
| ONB-DV-12 [Positive]: "Export All" on the landing grid produces a real bulk candidate list download | 184 | Functional | — | File downloaded | Medium |
| ONB-DV-03 [Positive]: A freshly-Cleared candidate appears in Verification Pending | 198 | Functional | — | Row found | High |
| ONB-DV-04 [Positive]: View Docs is disabled until a row is selected, then enabled | 205 | Functional | — | State toggles | Medium |
| ONB-DV-05 [Positive]: View Docs opens with all sections starting unverified | 216 | Functional | — | All counters 0 | Medium |
| ONB-DV-23 [Negative]: Verify is genuinely blocked server-side when Field Coordinator is left blank, even though it reports enabled | 226 | **Negative** | Check all, leave FC blank | Enabled but rejected server-side | **High** |
| ONB-DV-13 [Positive]: "Download All Docs" inside View Docs produces a real bulk document download | 274 | Functional | — | File downloaded | Medium |
| ONB-DV-06 [Edge]: Per-section counters update independently as checkboxes are checked | 292 | Functional | — | Counter increments | Medium |
| ONB-DV-25 [Edge]: Cancel discards unsaved checkbox progress, unlike Save As Draft | 312 | Functional | — | Counts reset to 0 | Medium |
| ONB-DV-07 [Edge]: "Save As Draft" preserves partial progress without moving off Verification Pending | 362 | Functional | — | Counts persist | **High** |
| ONB-DV-24 [Negative]: Verify silently does nothing when only some documents are checked | 427 | **Negative** | Partial docs + FC set | 200 OK, no commit | **High** |
| ONB-DV-14 [Edge]: "Send Back To Candidate" — confirmed correct but deliberately NOT completed to a real send | 462 | **Security** | Reach ready-state only | Stops before send (no recipient override exists) | **High** |
| ONB-DV-08 [Positive]: Field Coordinator selects "Akshay Gupta" | 509 | Functional | — | Shows "Akshay Gupta" | High |
| ONB-DV-09 [Edge]: Comments is optional - Verify works with it left blank | 529 | Validation | — | Verify enabled | Medium |
| ONB-DV-10 [Positive]: Verify shows a confirmation dialog and completes verification | 541 | Functional | All docs + FC set | Confirm dialog → completes | **Critical** |
| ONB-DV-11 [Positive]: Candidate moves to Verification Completed with status "Verified" | 546 | Functional | Post-Verify | Found in Completed as "Verified" | **Critical** |
| ONB-DV-27 [Edge]: Save As Draft succeeds even with zero changes made | 626 | Validation | 2nd fresh candidate | Always succeeds | Medium |
| ONB-DV-28 [Negative]: Send Back with nothing filled returns every missing-field validation at once | 642 | Negative | Blank Remarks+FC | Both errors shown | Medium |
| ONB-DV-29 [Negative]: Send Back with Remarks filled but Field Coordinator still blank is blocked on that alone | 659 | Negative | Remarks only | FC-only error | Medium |
| ONB-DV-30 [Edge]: Rapid double-click on Save As Draft does not produce a duplicate backend commit | 672 | Robustness | Double-click | ≤1 network commit | Medium |
| ONB-DV-31 [Edge]: Comments enforces a 200-character limit | 695 | Validation | 5000 chars | Truncated to 200 | Low |
| ONB-DV-32 [Positive]: An XSS-style payload in Comments is stored and rendered as inert literal text, never executed | 703 | **Security** | `<script>`/`onerror` payload | Never executes | **High** |
| ONB-DV-33 [Negative]: A simulated backend failure on Save As Draft shows a real error dialog instead of hanging silently | 732 | Robustness | Mocked 500 via `page.route` | Error dialog shown | Medium |
| ONB-DV-34 [Edge]: A browser refresh mid-flow returns to a working, logged-in view without crashing | 755 | Robustness | Hard reload | Session intact | Medium |
| ONB-DV-35 [Edge]: An invalidated session redirects to Login on the next action | 768 | **Security** | Cleared cookies | Redirects to Login | High |

**GenOfferLetter.spec.js** (23 tests, `akshay.gupta`, dummy "Demo User Alpha," reused indefinitely — this is the fullest, most-complete letter module):

| Test Name (exact string) | Line | Category | Priority |
|---|---|---|---|
| ONB-045 [Positive]: Selecting a candidate and clicking Gen Offer Letter opens the 3-tab page | 79 | Smoke | **Critical** |
| ONB-046 [Positive]: Candidate Name, Role, and Division are pre-filled and disabled | 87 | Functional | Medium |
| ONB-047 [Edge]: Designation options before any Vacant Position ID reselection can vary | 94 | Functional | Medium |
| ONB-048 [Positive]: State, HQ, Position Role auto-populate from Vacant Position ID and are disabled | 114 | Functional | Medium |
| ONB-049 [Positive]: Designation dropdown offers a large cascading option list | 122 | Functional | Medium |
| ONB-050 [Positive]: Manager Name auto-fills and is disabled | 127 | Functional | Medium |
| ONB-051 [Negative]: Date Of Joining accepts a past date with no inline validation error | 133 | **Negative (known bug)** | High |
| ONB-052 [Edge]: Picking a new Designation can reset editable salary fields, inconsistently | 152 | Functional | Medium |
| ONB-053 [Negative]: Calculate Salary does not silently succeed if a salary field is blank | 177 | Validation | Medium |
| ONB-055 [Negative]: Submit and Preview does not advance while salary is still invalid | 203 | Validation | Medium |
| ONB-056 [Positive]: Both toggles default to ON | 223 | Functional | Low |
| ONB-057 [Positive]: Cancel discards all changes with zero effect on the grid | 228 | Functional | Medium |
| ONB-054 [Positive]: A fully-filled Letter Details tab calculates Total CTC with no error | 247 | Functional | **Critical** |
| ONB-058 [Positive]: Submit and Preview with valid data succeeds and shows a success message | 267 | Functional | **Critical** |
| ONB-059 [Positive]: Preview Letter tab shows the generated PDF filename with a download link | 274 | Functional | Medium |
| ONB-060 [Positive]: "View Candidate Email" navigates to the Preview Candidate Email tab | 281 | Functional | Medium |
| ONB-061 [Negative]: To/CC auto-populate with a real internal address, not the candidate's own | 286 | **Security (known issue)** | High |
| ONB-062 [Positive]: To, CC, BCC, and Subject fields are editable pre-send | 299 | Functional | Low |
| ONB-063 [Positive]: Subject defaults to "Offer Letter" | 305 | Functional | Low |
| ONB-064 [Positive]: An attachment link to the generated PDF is present | 309 | Functional | Low |
| ONB-065 [Positive]: Overriding To/CC to the safe monitored address and sending succeeds | 313 | Functional (real send) | **Critical** |
| ONB-066 [Negative]: (not executed) sending without overriding To/CC would reach a real person | 326 | Negative | Medium — pseudo-test, no assertions |
| ONB-067 [Positive]: After a successful send, the grid's Offer Letter filter includes that candidate | 336 | Regression | Medium |

**GenAppointmentLetter.spec.js** (18 tests + 1 `test.skip`, ITAP 250347, page object is a pure re-export of `ITAP_GenerateOfferLetter`): mirrors GenOfferLetter's exact structure test-by-test (ONB-AL-01 through ONB-AL-17), with `ONB-AL-18` (`test.skip`) documenting a permanently blocked "not yet Verified" negative case. Standout: **ONB-AL-14** (line 294) is the direct inverse of ONB-061 — Appointment Letter's To field defaults to the *candidate's own personal email* rather than an internal colleague, an unresolved app inconsistency both files independently caught. **ONB-AL-05** (line 160) re-confirms the same past-DOJ bug as ONB-051.

**GenApprenticeLetter.spec.js** (2 real tests + 2 `test.skip`): `ONB-PL-01` (line 70, blocks an experienced candidate) and `ONB-PL-02` (line 86, blocks a non-MCPPL-division candidate) are the only tests that actually run — both are negative gate checks using only the grid, never opening the real Generate Apprentice Letter page. `ONB-PL-03` (the only possible happy path) and `ONB-PL-04` are permanently skipped — **Apprentice Letter has zero automated happy-path coverage.**

### 3.6 Training module — `tests/OpenTraining.spec.js`, `tests/Training.spec.js` (11 tests)

**No `expect()` assertions exist anywhere in either file.** Page objects don't extend `BasePage`. `Training.spec.js` reads `utils/Globals.js`'s `ctx.itapNumber` with no null-guard.

| Test Name (exact string) | File:Line | Category | Scenario | Priority |
|---|---|---|---|---|
| Complete Flow: Login and Add Training | OpenTraining.spec.js:18 | Smoke | Create a training slot | High |
| Verify Training appears in the list | OpenTraining.spec.js:92 | Regression | Check today's row visible | Low — **no assertion, can't fail** |
| TC01: Login to Training Portal | Training.spec.js:25 | Smoke | FC Admin login | Critical (gatekeeper for chain) |
| TC02: Navigate to Appointment Section | Training.spec.js:39 | Functional | Click Appointment | High |
| TC03: Navigate to Training Tab | Training.spec.js:50 | Functional | Click Training tab | High |
| TC04: Search for ITAP Number and Select Checkbox | Training.spec.js:60 | Functional | **Confirmed broken** — ignores its own parameter | **Critical (known bug)** |
| TC05: Create Training Batch | Training.spec.js:73 | Functional | Click "Create a batch" | Medium |
| TC06: Select Training Batch and Assign Candidate | Training.spec.js:83 | Functional | Same unused-parameter bug as TC04 | Medium |
| TC07: Assign and Preview Email | Training.spec.js:96 | Functional | Reach email preview | Medium |
| TC08: Update Email Recipient and Add Attachment | Training.spec.js:105 | **Regression (bug-fix)** | Overwrite To field (attachment step commented out) | **Critical** |
| TC09: Send Email to Candidate | Training.spec.js:125 | Functional (real send) | No recipient re-verification at send time | **Critical** |

---

## 4. Feature/Module Map

| Module | Test file(s) | Page object(s) | # Tests | Categories present | Key scenarios | Notable security/robustness | Related files |
|---|---|---|---|---|---|---|---|
| **Candidate** | Phase1.spec.js, Phase2.spec.js, SignUpSignIn.spec.js | pages/Candidate/*.js | 48 | Functional, Validation, Negative, Security, Robustness | Signup, Personal/Qualification/Experience details, document upload, sign-in, forgot password | TC-014 (SQLi/XSS), E09 (concurrency), E05 (Aadhaar whitespace bug) | utils/CandidateFlowHelpers.js |
| **Interview (grid/root)** | Interview.spec.js | pages/Interview.js, FCAdminLogin.js | 55 | Functional, Negative, Security, Regression, Robustness | Re-Schedule (read-only), Access Control, Login, grid structure & filters | FCI-04/INT-72 (access control), INT-54 (injection) | tests/Interview/* |
| **Interview (scheduling/status/email)** | Setup, StatusFeedback, PreviewCandidateEmail, PreviewInterviewerEmail | pages/Interview/*.js | 33 | Functional, Validation, Negative, Security | Schedule form validation, batch scheduling, feedback scores, final status, email previews | INT-27/INT-67 (asserted email safety), INT-29 (fix applied, not asserted) | utils/createFreshInterviewCandidate.js |
| **Onboarding (grid/root)** | Onboarding.spec.js | pages/Onboarding.js | 41 | Functional, Validation, Regression, Security | Document Status popup, grid structure, 20-column schema, all filters, export | ONB-069 (read-only Verified Status) | tests/Onboarding/* |
| **Onboarding (Doc Verification & Letters)** | DocumentVerification, GenOfferLetter, GenAppointmentLetter, GenApprenticeLetter | pages/Onboarding/*.js | 80 | Functional, Validation, Negative, Security, Robustness | HR document verification, letter generation & email | ONB-DV-32 (XSS), ONB-DV-35 (session invalidation), ONB-DV-23/24 (silent no-op) | utils/createClearedOnboardingCandidate.js |
| **Training** | OpenTraining.spec.js, Training.spec.js | pages/OpenTraining.js, Training.js | 11 | Functional (no real assertions) | Create training slot, assign to batch, send email | TC04 confirmed broken; TC08 past real email leak, now fixed | utils/Globals.js (ctx.itapNumber) |

**Mental shortcut:** "Candidate-facing" = candidate portal (Candidate/*). Everything else logs into **FC Admin** (`akshay.gupta`) except Document Verification, which is the one screen behind a **separate HR login** (`nimisha`).

---

## 5. Boss Question → Test Case Lookup

| Manager's question | Matching test(s) | File | Short explanation |
|---|---|---|---|
| "Do we test what happens if the candidate submits an empty form?" | TC-015 (Personal Details), TC-009 (Signup form) | Phase1.spec.js:42, SignUpSignIn.spec.js:309 | Blank-form submits are blocked with visible field-level validation messages. |
| "Where is the duplicate candidate scenario tested?" | TC-003 | SignUpSignIn.spec.js:198 | Signs up twice with the same Aadhaar in one run; 2nd attempt is blocked. |
| "Do we have validation for invalid email?" | TC-004 | SignUpSignIn.spec.js:231 | Covers both malformed email AND an official @mankindpharma.com address (also blocked, a Mankind-specific rule). |
| "Is there a security test for this?" (candidate side) | TC-014 | SignUpSignIn.spec.js:60 | SQL-injection/XSS strings submitted as Aadhaar/password — no script executes, generic rejection shown. |
| "Is there a security test for this?" (FC Admin grid) | INT-54 | Interview.spec.js:745 | Injection strings in grid filters treated as plain text, no execution/SQL error. |
| "Is there a security test for this?" (Document Verification) | ONB-DV-32 | DocumentVerification.spec.js:703 | XSS payload in Comments stored/rendered as inert text, never executes. |
| "Do we test unauthorized access?" | FCI-04 / INT-72 | Interview.spec.js:219 / :203 | Restricted-role account has no "Appointment" sidebar item; full-access account does. Note: the equivalent test for Document Verification does **not exist** — see Section 9. |
| "Where do we test this field being mandatory?" | Varies by field — e.g. INT-59 (Interviewer date), INT-33/INT-35 (Final Status), ONB-DV-28/29 (Send Back Remarks/Field Coordinator) | Setup.spec.js:107, StatusFeedback.spec.js:410/431, DocumentVerification.spec.js:642/659 | Use Section 6 for the specific field. |
| "Do we test the manager referral flow?" | TC-007 | SignUpSignIn.spec.js:281 | Only tests an *invalid* Manager Reference ID being rejected — there's no dedicated positive-path test that a correct Manager Ref ID successfully links a referral. |
| "What happens when the user enters invalid data?" | See the per-field validation rows throughout Section 3 (PAN, mobile, PIN, vehicle number, UAN, file type/size) | Phase1/Phase2.spec.js | Each malformed-field case has its own dedicated negative test. |
| "Do we test email doesn't leak to a real person?" | INT-27, INT-67 (asserted); INT-29, ONB-AL-16, ONB-065 (fix applied, not all asserted); TC08 Training (fix applied, not asserted) | See Section 3.3 / 3.5 / 3.6 | This is the single most important "gotcha" area — read Section 9 before answering confidently. |
| "Do we test the interview scheduling happy path?" | FCI-01 | Setup.spec.js:306 | 2-candidate batch schedule + both real emails sent + grid confirms Scheduled. |
| "Do we test double-booking a candidate?" | TC-039 | Interview.spec.js:781 | Scheduling an already-scheduled candidate is blocked with a clear error. Conditionally `test.skip`s if no live scheduled round exists that day. |
| "Do we test rejecting a candidate at final status?" | TC-043 | StatusFeedback.spec.js:315 | The only place "Rejected" (vs. "Cleared") is exercised end-to-end. |
| "Do we test the document verification workflow end-to-end?" | ONB-DV-10, ONB-DV-11 | DocumentVerification.spec.js:541/546 | Full Verify action + confirms the one-way move to "Verification Completed." |
| "Do we test what happens if Field Coordinator isn't set?" | ONB-DV-23 | DocumentVerification.spec.js:226 | Verify button *reports* enabled but is genuinely rejected server-side — "don't trust the UI enable-state" finding. |
| "Do we test offer letter generation and sending?" | ONB-045…ONB-067 | GenOfferLetter.spec.js | Full happy path incl. real email send, using recurring dummy "Demo User Alpha." |
| "Do we have apprentice letter coverage?" | ONB-PL-01, ONB-PL-02 only (real); ONB-PL-03 skipped | GenApprenticeLetter.spec.js | Only the two negative gates run — **no happy-path coverage exists.** |
| "Is the Training module reliable?" | — | Training.spec.js, OpenTraining.spec.js | No — header comments call it "UNVERIFIED/NEEDS REWORK," zero assertions, TC04 confirmed broken. |
| "Do we test concurrency / race conditions?" | E09 (Candidate signup), ONB-DV-30 (Save As Draft double-click) | SignUpSignIn.spec.js:498, DocumentVerification.spec.js:672 | Both check that a rapid double-action doesn't cause duplicate backend effects. |
| "Do we test session expiry/security?" | ONB-DV-35 (session invalidation via cleared cookies); INT-50 (idle timeout) | DocumentVerification.spec.js:768; Interview.spec.js:344 | DV-35 is real & passes; INT-50 is permanently `test.skip`'d as "not automatable." |

---

## 6. Keyword/Synonym → Test Case Index

Grouped by concept; each line lists likely phrasings a manager might use.

**Empty / blank / missing required field** ("mandatory field," "required field missing," "nothing filled in"):
→ TC-015 (Phase1.spec.js:42), TC-009 (SignUpSignIn.spec.js:309), INT-59/INT-21 (Setup.spec.js:107/117), INT-33/INT-35 (StatusFeedback.spec.js:410/431), ONB-DV-28/29 (DocumentVerification.spec.js:642/659), TC-030 (Phase2.spec.js:131, missing document).

**Invalid email / wrong email / bad email format / email validation**:
→ TC-004 (SignUpSignIn.spec.js:231) — covers both malformed format and blocked official domain.

**Duplicate / already exists / re-registration**:
→ TC-003 (SignUpSignIn.spec.js:198, duplicate Aadhaar signup); FCI-02 (Setup.spec.js:360, ineligible candidate mixed into a batch); INT-42 (StatusFeedback.spec.js:185, duplicate feedback — **but has no assertions**).

**SQL injection / XSS / script injection / malicious input / security payload**:
→ TC-014 (SignUpSignIn.spec.js:60), INT-54 (Interview.spec.js:745), ONB-DV-32 (DocumentVerification.spec.js:703).

**Unauthorized access / access control / permissions / restricted role / can't log in**:
→ FCI-04 / INT-72 (Interview.spec.js:219/203); TC-040 (Interview.spec.js:297, wrong credentials); **gap:** no equivalent test exists for Document Verification (see Section 9).

**Password policy / weak password / password mismatch**:
→ TC-005 (mismatch, SignUpSignIn.spec.js:253), TC-006 (policy tooltip + enforcement, SignUpSignIn.spec.js:262).

**File upload / document upload / wrong file type / file too large / missing document**:
→ TC-028 (wrong type), TC-029 (oversized), TC-030 (missing mandatory doc), TC-032 (replace file) — all Phase2.spec.js.

**Character limit / max length / truncation**:
→ E01–E05, E10 (SignUpSignIn.spec.js, Aadhaar/Manager Ref ID/Email/Password lengths); INT-34 (Remarks maxlength, Interview.spec.js:823); ONB-DV-31 (Comments maxlength, DocumentVerification.spec.js:695).

**Concurrency / race condition / double-click / simultaneous**:
→ E06/E07 (double-click Signup/Sign-In), E09 (concurrent signup, SignUpSignIn.spec.js), ONB-DV-30 (double-click Save As Draft).

**Browser refresh / reload / mid-form**:
→ TC-021 (Phase1.spec.js:115), E08 (SignUpSignIn.spec.js:419), ONB-DV-34 (DocumentVerification.spec.js:755).

**Email destination / where do emails go / candidate email leak / interviewer email**:
→ INT-27/INT-67 (asserted safe, PreviewInterviewerEmail.spec.js), INT-29 (fix applied but unasserted, PreviewCandidateEmail.spec.js:92), ONB-AL-14/ONB-061 (letter email defaults, inconsistent between letter types), TC08/TC09 (Training.spec.js — past real leak, now fixed, still unverified by assertion).

**Interview scheduling / schedule interview / book an interview**:
→ FCI-01 (happy path, Setup.spec.js:306), TC-039 (double-booking blocked, Interview.spec.js:781), INT-59/INT-21/TC-036/TC-037 (form validation, Setup.spec.js).

**Reschedule**:
→ INT-24, INT-25, INT-64, INT-26, INT-65 (all Interview.spec.js:51-177) — all read-only/cancel-only, never a completed reschedule.

**Grid filters / search / narrow down results**:
→ Dozens — see Section 3.2 (INT-07 through INT-57) and Section 3.4 (ONB-017 through ONB-036) for the full per-column list.

**Export to Excel / download report**:
→ INT-13/INT-73/INT-58/INT-15 (Interview.spec.js), ONB-DV-12/ONB-DV-13 (DocumentVerification.spec.js), ONB-039 (Onboarding.spec.js:593).

**Document verification / verify documents / HR review**:
→ ONB-DV-01 through ONB-DV-35 (entire DocumentVerification.spec.js) — the deepest single-feature coverage in the suite.

**Field Coordinator**:
→ ONB-DV-08 (DocumentVerification.spec.js:509) — always must be "Akshay Gupta" per project convention.

**Send Back to candidate**:
→ ONB-DV-14 (DocumentVerification.spec.js:462) — deliberately does not complete a real send; no recipient-override field exists in the app at all (permanent gap, tied to a real past leak incident).

**Offer letter / appointment letter / apprentice letter / letter generation**:
→ ONB-045–067 (Offer, full coverage), ONB-AL-01–18 (Appointment, mirrors Offer), ONB-PL-01–04 (Apprentice, only 2 of 4 tests actually run).

**Rejected / cleared / final status**:
→ TC-043 (Rejected path, StatusFeedback.spec.js:315), INT-36 (Cleared path, StatusFeedback.spec.js:496).

**Feedback score / evaluation score**:
→ INT-69 (out-of-range rejected), INT-70 (boundary 0/10 accepted) — StatusFeedback.spec.js:120/162.

**Session timeout / session expired / logged out unexpectedly**:
→ ONB-DV-35 (real, cleared-cookies test, passes); INT-50 (idle timeout, permanently `test.skip`'d, "not automatable").

**Training / training batch / assign to training**:
→ TC01–TC09 (Training.spec.js) — module flagged unreliable; TC04 confirmed broken.

---

## 7. Tier 1 / 2 / 3 Study Priorities

### Tier 1 — Must Know (deep understanding, ~20 items/stories)

These were chosen because they're either (a) the one true happy-path test for their module, (b) a genuine security/access-control test, (c) tied to a real bug this project found and fixed, or (d) a currently-open, unresolved question a sharp manager would probe.

1. **P08** (SignUpSignIn.spec.js:461) — the *only* genuine end-to-end candidate signup + sign-in happy path in the Candidate module. Nearly every other Candidate test assumes signup/sign-in already work; this is what actually proves it.
2. **TC-014** (SignUpSignIn.spec.js:60) — candidate-side SQL-injection/XSS test. The clearest "yes, we test security" answer for the candidate portal.
3. **TC-003** (SignUpSignIn.spec.js:198) — duplicate-Aadhaar prevention. Also a hidden-dependency story: several other tests earlier in the same file quietly assume this test already ran and registered the shared test account.
4. **TC-030** (Phase2.spec.js:131) — blocks final application submission when a mandatory document is missing. Guards the single most consequential gate in the candidate journey.
5. **TC-019** (Phase1.spec.js:82) — **deliberately failing.** Documents a real, still-open app bug (a future "past interview date" is wrongly accepted). Know this so you don't call it a broken test.
6. **FCI-04 + INT-72** (Interview.spec.js:219, :203) — the access-control pair: a restricted account genuinely cannot reach Appointment; a full-access account genuinely can. This is *the* answer to "do we test unauthorized access."
7. **INT-54** (Interview.spec.js:745) — injection-string test on the FC Admin grid's filters (parallel to TC-014 on the candidate side).
8. **INT-83** (Interview.spec.js:453) — asserts the grid's exact 12-column order. Other code (`getFirstRowRegId()`) silently depends on this order being right — a "if this breaks, everything downstream breaks quietly" test.
9. **INT-24 & INT-25** (Interview.spec.js:51, :70) — both document *real, confirmed* UI bugs in Re-Schedule (button never disables; "Search by Candidate" mode never works). Good example of tests that pass while documenting a real product defect.
10. **FCI-01** (Setup.spec.js:306) — the fullest Interview happy path: 2-candidate batch scheduling through both real email sends, grid confirms Scheduled.
11. **INT-27 & INT-67** (PreviewInterviewerEmail.spec.js:76, :127) — the *only* tests in the entire email-safety area that actually **assert** the recipient equals the safe test inbox (`config.EmailId`). This is your strongest "yes, we verify emails don't leak" answer.
12. **INT-29** (PreviewCandidateEmail.spec.js:92) — the direct counterpart to #11, but on the side of the app that had a **real historical leak** (to a candidate's personal Gmail, fixed 2026-09-07). Know that the fix is *applied* here but **not independently asserted** — a good-faith answer, not a cover-up.
13. **INT-36 & TC-043** (StatusFeedback.spec.js:496, :315) — the two real, mutating Final-Status outcomes: Cleared and Rejected. Everything else in that describe block is validation around these two end states.
14. **ONB-DV-10 & ONB-DV-11** (DocumentVerification.spec.js:541, :546) — the one true one-way state transition in the whole suite: Verify → "Verification Completed."
15. **ONB-DV-23 & ONB-DV-24** (DocumentVerification.spec.js:226, :427) — "the Verify button lies": it visually reports enabled, but the server silently rejects a blank Field Coordinator (DV-23) or a partial document set (DV-24, HTTP 200 with zero effect). The clearest illustration of "don't trust the UI/HTTP status alone" in this codebase.
16. **ONB-DV-14** (DocumentVerification.spec.js:462) — directly tied to a real email-leak incident. Unlike the Interview email flows, "Send Back To Candidate" has **no recipient-override control anywhere in the app**, so this test deliberately stops short of a real send — a permanent, structural gap, not a temporary one.
17. **ONB-DV-01 + the akshay.gupta contradiction** (DocumentVerification.spec.js:67; config.js:59-62) — the single most important open question in the whole suite. `config.js`'s own comment says akshay.gupta has no Document Verification access; separate project history says the opposite was observed live. **No test resolves this either way.** You should be ready to say exactly this if asked.
18. **ONB-DV-32** (DocumentVerification.spec.js:703) — the clearest XSS/security-hardening test in the suite (payload stored and rendered as inert text, never executed).
19. **ONB-061 & ONB-AL-14** (GenOfferLetter.spec.js:286, GenAppointmentLetter.spec.js:294) — two letter-generation files independently caught the *same class* of email-default problem, with **opposite** results (Offer Letter defaults to an internal colleague; Appointment Letter defaults to the candidate's own email). Both require a manual override before every real send.
20. **TC04 / TC08 / TC09** (Training.spec.js:60, :105, :125) — know that Training is the weak link: TC04 is confirmed broken, and TC08/TC09 carry the same email-safety story as #12, but with even less verification (zero assertions in the whole module).

### Tier 2 — Should Know (concise, ~40 items)

*Candidate:* TC-004 (invalid/official email), TC-005/TC-006 (password rules), TC-008 (silent checkbox-block), E05 (Aadhaar whitespace data-integrity bug), E09 (concurrent signup race), TC-012/TC-013 (sign-in negatives), TC-N11 (sign-in checkbox), TC-016/017/018/020 (per-field format validation), TC-022/023/025 (date-order & percentage validation), TC-028/029 (file type/size).

*Interview (grid):* INT-48 (login smoke test), INT-87 (flag: non-functional placeholder, don't cite as real coverage), INT-06 (mutation requires confirmation), INT-07/TC-038 (Reg ID filter + regression fix for a stale-ID bug), INT-12/INT-51 (filter clear/empty states), INT-04 (Schedule button gating), INT-05/INT-32 (Candidate Status popup — near-duplicates), TC-039 (double-booking, conditionally skipped).

*Interview (setup/status/email):* INT-18/INT-59/INT-21/TC-037 (schedule form validation cluster), TC-036 (deliberately-failing End<Start time bug), FCI-02 (batch with an ineligible candidate), INT-23/INT-62/INT-63 (cancel/edge cases), INT-69/INT-70 (feedback score bounds), INT-33/INT-35 (Final Status mandatory-field pair — near-duplicates), INT-45 (documented finding: no rejection-reason field), INT-30/INT-66 (email field negative-input gaps, documented not fixed).

*Onboarding (grid):* ONB-005/ONB-007/ONB-009 (structural smoke tests other tests depend on), ONB-037/ONB-038 (filter-clear regression pair — a real bug this suite found in itself), ONB-040 through ONB-044 (Document Status popup chain — fragile, shares one dialog), ONB-069 (Verified Status read-only security check), ONB-010 (flag: placeholder, not real coverage), ONB-016 (self-correcting comment history — good example to cite if asked about the team's rigor).

*Onboarding (DocVerification/Letters):* ONB-DV-03/04/05 (core Verify-flow setup steps), ONB-DV-07 (Save-As-Draft persistence, guards a real past hang bug), ONB-DV-08 (Field Coordinator convention), ONB-DV-35 (session-invalidation security check), ONB-045/ONB-054/ONB-058/ONB-065 (Offer Letter happy-path spine), ONB-PL-01/ONB-PL-02 (Apprentice Letter's only 2 real tests — both negative gates), ONB-AL-01/ONB-AL-05/ONB-AL-16 (Appointment Letter spine + known past-date bug).

*Training:* "Complete Flow: Login and Add Training" (OpenTraining's only real smoke test).

### Tier 3 — Know How to Find (everything else, ~200 items)

You do not need to memorize these individually — know the **pattern** and where to look:
- **Dropdown-option-list tests** (Onboarding.spec.js ONB-019/020/023/024/025/031/033/034/036, and equivalents in DocumentVerification.spec.js): all follow "read a dropdown, assert its exact option set" — one line of logic repeated per column. If asked about a specific dropdown's options, go straight to Section 3.4's table and match the column name.
- **Per-column filter tests** (INT-07 through INT-57 in Interview.spec.js; ONB-017 through ONB-036 in Onboarding.spec.js; ONB-DV-17 through ONB-DV-22 in DocumentVerification.spec.js): same "type a value → grid narrows → clear → grid restores" pattern per column.
- **Page-structure/smoke tests** (INT-75 through INT-92 in Interview.spec.js; ONB-005 through ONB-016 in Onboarding.spec.js): cosmetic/structural checks — tab presence, badge counts, icon visibility, pagination text format. Low individual stakes, but collectively they're what would catch a broken page layout.
- **Letter-generation Pass-A/Pass-B negative-validation cluster** (ONB-047 through ONB-057 and the Appointment Letter equivalents): the same salary/DOJ/toggle validation logic repeated per letter type.
- **Robustness edge cases** (double-click tests, refresh-mid-form tests, viewport/narrow-width tests, max-length truncation tests): same shape everywhere — "do something unusual, confirm the app doesn't break." If your manager names one you don't recognize, search Section 6's "Character limit," "Browser refresh," or "Concurrency" rows first.

---

## 8. Feature-Level Cheat Sheets

**FEATURE: Candidate Signup & Application**
- Main purpose: public-facing signup, sign-in, and the two-phase job application form.
- Main test file(s): `tests/Candidate/Phase1.spec.js`, `Phase2.spec.js`, `SignUpSignIn.spec.js`.
- Number of tests: 48.
- Core scenarios: signup, Personal/Qualification/Experience details, document upload, sign-in, forgot password.
- Important positive tests: P08 (signup→signin), TC-024 (multi-qualification), TC-032 (file replace).
- Important negative tests: TC-003 (duplicate Aadhaar), TC-012/013 (bad sign-in), TC-030 (missing document).
- Validation tests: TC-004 through TC-009, TC-015 through TC-031 (nearly every field has one).
- Security tests: TC-014 (injection), TC-N11/TC-008 (checkbox-gated consent, silent failure).
- Edge/robustness tests: E01–E11 (character limits, double-click, refresh, whitespace, paste, concurrency).
- Important test data: `config.DuplicateTestAadhar` (shared, order-dependent — see Section 9), `getRandomAadhar()` for fresh signups per test.
- Common helper functions: `utils/CandidateFlowHelpers.js` (`signupAndReachPhase1`, `fillValidPersonalDetails`, `fillValidQualification`).
- Related features: feeds Interview module via `utils/createFreshInterviewCandidate.js`.
- Tests to memorize: P08, TC-014, TC-003, TC-030, TC-019.
- Tests to just know how to locate: all E0x edge-case tests, all per-field validation tests (Section 3.1 table).

**FEATURE: Interview Scheduling, Access Control & Grid**
- Main purpose: FC Admin schedules interviews, reviews/filters the interview grid, and reschedules (read-only in tests).
- Main test file(s): `tests/Interview.spec.js`, `tests/Interview/Setup.spec.js`.
- Number of tests: 55 + 13 (Setup block) = 68.
- Core scenarios: login, access control, grid structure/filters, schedule-form validation, batch scheduling.
- Important positive tests: INT-72, INT-48, FCI-01, INT-83.
- Important negative tests: FCI-04, TC-040, TC-039 (double-booking), FCI-02 (ineligible candidate in batch).
- Validation tests: INT-59/21 (mandatory fields), TC-037 (past date), INT-04 (button gating).
- Security tests: FCI-04/INT-72 (access control), INT-54 (injection in filters).
- Edge/robustness tests: INT-90/91/92 (layout robustness), INT-63/62 (batch edge cases), TC-036 (deliberately-failing time-order bug).
- Important test data: "Test Can" dummy rows, `config.username`/`password` (akshay.gupta), `RESTRICTED_USERNAME` (Kanika).
- Common helper functions: `pages/Interview.js`'s `ITAP_InterviewGrid`/`ITAP_ReScheduleInterview`; `pages/FCAdminLogin.js`'s shared `ITAP_Login`.
- Related features: feeds into StatusFeedback and both email-preview files.
- Tests to memorize: FCI-04/INT-72, INT-54, INT-83, FCI-01, INT-24/INT-25.
- Tests to just know how to locate: all per-column filter tests, all page-structure smoke tests.

**FEATURE: Interview Feedback, Final Status & Email Previews**
- Main purpose: capturing interview feedback scores, setting Cleared/Rejected final status, and safely previewing/sending the two outbound emails (to interviewer, to candidate).
- Main test file(s): `tests/Interview/StatusFeedback.spec.js`, `PreviewCandidateEmail.spec.js`, `PreviewInterviewerEmail.spec.js`.
- Number of tests: 10 + 5 + 5 = 20.
- Core scenarios: feedback score bounds, Final Status validation, To/CC email field behavior.
- Important positive tests: INT-36 (Cleared), TC-043 (Rejected), INT-28 (interviewer email sent).
- Important negative tests: INT-33/INT-35 (mandatory Final Status), INT-69 (out-of-range score).
- Validation tests: INT-70 (boundary scores), INT-68 (Remarks maxlength).
- Security tests: **INT-27/INT-67 (asserted email-destination safety)**; INT-29 (fix applied, not asserted — the historically riskier side).
- Edge/robustness tests: INT-42 (no assertions — flag if asked), INT-45 (documented finding).
- Important test data: `config.EmailId` = `yuvraj.intern@mankindpharma.com` (the only safe destination).
- Common helper functions: each file's own `beforeAll` schedule+allocate+submit+confirm sequence (duplicated 6x project-wide, not shared — a maintenance note, not a test gap).
- Related features: depends on Setup.spec.js's scheduling having already worked; feeds Onboarding via `utils/createClearedOnboardingCandidate.js`.
- Tests to memorize: INT-27, INT-67, INT-29, INT-36, TC-043.
- Tests to just know how to locate: everything else in this cheat sheet.

**FEATURE: Onboarding Grid & Document Status**
- Main purpose: FC Admin's onboarding grid — filters, columns, export, and a read-only Document Status popup.
- Main test file(s): `tests/Onboarding.spec.js`.
- Number of tests: 41.
- Core scenarios: grid structure (20 columns), per-column filters, Document Status popup, export.
- Important positive tests: ONB-005/007/009 (structural baseline), ONB-040 (popup opens).
- Important negative tests: none dedicated — mostly Functional/Regression here.
- Validation tests: ONB-019 through ONB-036 (dropdown option sets).
- Security tests: ONB-069 (Verified Status is read-only for FC Admin).
- Edge/robustness tests: ONB-037/038 (filter-clear regression pair — a real bug this suite found and fixed in itself).
- Important test data: recurring dummy "Demo User Alpha," ITAP 250347 (for ONB-069).
- Common helper functions: `pages/Onboarding.js`'s `ITAP_OnboardingGrid` (`filterByName`, `clearAllFilters`, `findFirstNonEmptyColumnValueAcrossPages`).
- Related features: distinct from, and does not overlap with, `tests/Onboarding/*`.
- Tests to memorize: ONB-037, ONB-038, ONB-040, ONB-069, ONB-009.
- Tests to just know how to locate: all dropdown-option and per-column filter tests.

**FEATURE: HR Document Verification**
- Main purpose: HR (`nimisha` login, separate from FC Admin) reviews and verifies a candidate's uploaded documents — the one genuinely one-way status transition in the suite.
- Main test file(s): `tests/HR/DocumentVerification.spec.js` (its own module, 2026-09-08 — moved out of tests/Onboarding/ since it's a distinct HR-only portal).
- Number of tests: 35 (across two `describe.serial` blocks — main chain + Robustness & Security).
- Core scenarios: grid/filters, View Docs, checkbox verification, Field Coordinator, Verify, Save As Draft, Send Back.
- Important positive tests: ONB-DV-10/11 (Verify happy path), ONB-DV-08 (Field Coordinator convention).
- Important negative tests: ONB-DV-23 (Verify's misleading enabled state), ONB-DV-24 (silent no-op on partial docs), ONB-DV-28/29 (Send Back validation).
- Validation tests: ONB-DV-09/31.
- Security tests: **ONB-DV-32 (XSS)**, **ONB-DV-35 (session invalidation)**, ONB-DV-14 (Send Back — permanently incomplete by design).
- Edge/robustness tests: ONB-DV-30 (double-click idempotency), ONB-DV-33 (simulated 500 error), ONB-DV-34 (refresh mid-flow).
- Important test data: a **fresh** candidate every run (via `createClearedOnboardingCandidate()`), never a reused dummy — because Verify is one-way.
- Common helper functions: `pages/HR/DocumentVerification.js`; `utils/createClearedOnboardingCandidate.js`.
- Related features: **open question** — whether FC Admin (`akshay.gupta`) also has access to this screen is unresolved (see Section 9); this is the single most important gap to be ready to discuss.
- Tests to memorize: ONB-DV-01 (and the access-control gap it doesn't cover), ONB-DV-23, ONB-DV-24, ONB-DV-10/11, ONB-DV-14, ONB-DV-32.
- Tests to just know how to locate: all filter/pagination tests (ONB-DV-15 through ONB-DV-22, ONB-DV-26).

**FEATURE: Offer / Appointment / Apprentice Letter Generation**
- Main purpose: generate and email an Offer, Appointment, or Apprentice letter for an already-Verified candidate.
- Main test file(s): `tests/Onboarding/GenOfferLetter.spec.js` (most complete), `GenAppointmentLetter.spec.js` (mirrors it), `GenApprenticeLetter.spec.js` (mostly skipped).
- Number of tests: 23 + 18(+1 skip) + 2(+2 skip) = 43 real + 3 skipped.
- Core scenarios: open 3-tab letter page, cascading field auto-fill, salary calculation, Submit & Preview, email send.
- Important positive tests: ONB-045/054/058/065 (Offer Letter spine), ONB-AL-01/11/12/16 (Appointment Letter spine).
- Important negative tests: ONB-PL-01/02 (Apprentice Letter's business-rule gates — experienced-candidate block, non-MCPPL-division block).
- Validation tests: ONB-053/055 (blank/invalid salary blocks Submit).
- Security tests: **ONB-061 vs ONB-AL-14** — the same email-default check gives opposite (both concerning) results between letter types.
- Edge/robustness tests: ONB-051/ONB-AL-05 (deliberately-failing past-DOJ-accepted bug, confirmed in both letter types independently).
- Important test data: "Demo User Alpha" (Offer/reused), ITAP 250347 (Appointment/reused), ITAP 250349 (Apprentice negative gate).
- Common helper functions: `pages/Onboarding/GenOfferLetter.js`'s `ITAP_GenerateOfferLetter` — literally re-exported and reused unchanged by the other two letter types' page objects.
- Related features: requires the candidate to already be Document-Verified.
- Tests to memorize: ONB-065/ONB-AL-16 (real sends, must always target config.EmailId), ONB-061/ONB-AL-14 (the inconsistency), ONB-PL-01/02 (know these are the ONLY Apprentice tests that run).
- Tests to just know how to locate: everything else — it's the same 17-test template applied twice.

**FEATURE: Training**
- Main purpose: create a training slot (Open Training) and assign an already-interviewed candidate into a training batch, then email them.
- Main test file(s): `tests/OpenTraining.spec.js`, `tests/Training.spec.js`.
- Number of tests: 11.
- Core scenarios: create training slot, search candidate by ITAP number, assign to batch, send email.
- Important positive tests: none reliably — see caveat below.
- Important negative tests: none.
- Validation tests: none.
- Security tests: none — this is the module's biggest gap.
- Edge/robustness tests: none.
- **Caveat that overrides the categories above: zero `expect()` assertions exist in this entire module.** Every "pass" only means no exception was thrown.
- Important test data: `ctx.itapNumber` from `utils/Globals.js` (cross-file, no null-guard here).
- Common helper functions: none shared with the rest of the project — Training's page objects don't even extend `BasePage`.
- Related features: consumes a candidate produced by the Interview module.
- Tests to memorize: TC04 (confirmed broken), TC08/TC09 (past real email leak, fixed but unverified).
- Tests to just know how to locate: TC01–TC03, TC05–TC07, OpenTraining's 2 tests.

---

## 9. Coverage Gaps / Duplicates / Concerns

### Confirmed by code (verified by reading the actual source, not inference)

- **Unresolved contradiction on Document Verification access**: `config.js` (lines 59-62) comments that FC Admin's `akshay.gupta` has no Document Verification sidebar access; separate project history recorded the opposite being observed live. **No test checks this either way** — this is the single biggest open item to flag.
- **Training module has zero assertions** across all 11 tests (both files). `TC04` is confirmed actually broken (`searchRegID()` hardcodes a stale value and ignores its parameter; `selectCheckboxByRegID()` builds an unused locator and clicks a generic first checkbox instead).
- **Candidate-email destination fix is unverified**: `INT-29` (PreviewCandidateEmail.spec.js:92) exercises `updateCandidateToEmail()` — the exact function that fixed a real historical leak — but never asserts `toHaveValue(config.EmailId)`, unlike the interviewer-side equivalent (`INT-27`/`INT-67`), which does.
- **"Send Back To Candidate" has no recipient-override control in the DOM at all** (`ONB-DV-14`) — a permanent, structural gap tied to a real, already-reverted leak incident.
- **Two non-functional placeholder tests always pass regardless of real app state**: `INT-87` (Interview.spec.js:415, `expect(true).toBe(true)`) and `ONB-010` (Onboarding.spec.js:273, same pattern) — both could be mistaken for real coverage in a pass/fail report.
- **`INT-42`** (duplicate feedback submission) and **`ONB-066`** (Offer Letter, "sending without override") have no assertions at all — they record annotations only.
- **Deliberately-failing tests documenting known open app bugs** (not automation defects): `TC-019` (Candidate, future interview date wrongly accepted), `TC-036` (Interview Setup, End<Start time silently accepted), `ONB-051`/`ONB-AL-05` (Offer/Appointment Letter, past DOJ silently accepted).
- **Permanently skipped tests**: `INT-50` (idle timeout, "not automatable"), `ONB-AL-18`/`ONB-PL-04` (blocked on the same structural Feedback-routing bug), `ONB-PL-03` (Apprentice Letter's only possible happy path — **zero automated happy-path coverage exists for this letter type**).
- **Two real, independently-caught, unresolved app inconsistencies**: `ONB-061` vs `ONB-AL-14` (opposite email-recipient defaults between Offer and Appointment letters); `INT-24` (Re-Schedule button never disables) and `INT-25` (Re-Schedule "Search by Candidate" never works).

### Duplicates / overlaps (confirmed)

- `E01` is reused as a test **name** in two unrelated files (Phase1.spec.js:134 vs SignUpSignIn.spec.js:344) — searching "E01" alone returns both.
- `INT-05` and `INT-32` both open the same Candidate Status popup; `INT-32` subsumes `INT-05`.
- `INT-33` and `INT-35` are near-total duplicates (same action, same core assertion; `INT-35` just adds a grid-unchanged check).
- Nine tests in Onboarding.spec.js (`ONB-019/020/023/024/025/031/033/034/036`) share one identical one-line "read dropdown, assert exact option set" pattern.
- `GenOfferLetter.spec.js` and `GenAppointmentLetter.spec.js` implement the **same 17-test sequence** against a literally shared/re-exported page object — legitimate per-letter-type coverage, but worth knowing it's one template, not two independently-designed suites.
- Login logic is implemented three separate times (`ITAP_Login` shared by Interview/Onboarding; separate inline versions in `pages/OpenTraining.js` and `pages/Training.js`).

### Interpretation / recommendation (not confirmed defects — flagged as such)

- No true candidate-side "successful submission" assertion exists within the Candidate module itself — the full-flow proof lives only in the separate `utils/createFreshInterviewCandidate.js` helper.
- No test combines two or more grid filters simultaneously anywhere in Interview or Onboarding — every filter is tested in isolation.
- No test inspects actual exported file *contents* anywhere — Export tests only check the filename pattern / absence of an error dialog.
- No accessibility or performance/load testing exists anywhere in the suite.
- Access control is tested for exactly one restricted role, at the whole-module level only — no per-tab or partial-permission testing.

---

## 10. How to Quickly Find Any Test in VS Code

1. **You have a native ID** (e.g., "INT-24", "ONB-DV-08", "TC-030"): `Ctrl+Shift+F` → search the ID string exactly. It appears once, at the start of the test name. Fastest method — use it whenever the manager gives you *any* recognizable ID.
2. **You have a scenario in plain English, no ID**: use Section 6 (Keyword Index) first to translate it into a likely ID or file, then jump there directly, or `Ctrl+Shift+F` for a distinctive phrase from the scenario (e.g., "malformed PAN", "Field Coordinator", "double-click").
3. **You know the module but not the specific test**: open the matching file directly from Section 3/4 — file paths are exact and clickable in this document.
4. **You want everything in one category** (e.g., "all security tests"): `Ctrl+Shift+F` for `[Negative]` or the word `Security` — most Interview/Onboarding tests self-tag with `[Positive]`/`[Negative]`/`[Edge]` right in the name.
5. **You want to see test structure without reading code**: `Ctrl+Shift+O` (Outline view) inside any `.spec.js` file lists every `test(...)`/`describe(...)` call as a jump-to list.
6. **Global fallback**: `Ctrl+Shift+F` for the exact wording from this document's tables — every test name here was copied verbatim from the code.

---

## 11. 30-Minute Study Plan

- **5 min** — Read Section 1 (Executive Summary) and Section 15 (One-Page Revision Sheet).
- **15 min** — Read all 20 Tier 1 items in Section 7 with their file:line references open in a second window.
- **10 min** — Skim Section 4 (Feature/Module Map) until you can say, without looking, which file(s) belong to Candidate / Interview / Onboarding / Training.

**Goal after 30 minutes:** you can answer "do we test X" for the most likely topics (security, email safety, core happy paths, the akshay.gupta access-control gap) and know instantly which file any named module lives in.

## 12. 1-Hour Study Plan

Everything in the 30-minute plan, plus:
- **+15 min** — Read all of Tier 2 in Section 7 (concise, one-liners — don't over-read).
- **+10 min** — Read Section 9 (Gaps/Duplicates/Concerns) in full. Managers ask about gaps more than they ask about happy paths.
- **+5 min** — Skim Section 6 (Keyword Index) once, so the *habit* of translating a question into a keyword cluster is fresh.

## 13. 2-Hour Study Plan

Everything in the 1-hour plan, plus:
- **+30 min** — Pick the module you think is most likely to come up (whatever you've worked on most recently) and read its full table in Section 3 line by line.
- **+20 min** — Read all 7 cheat sheets in Section 8.
- **+10 min** — Cover the answers and do the Section 14 mock questions cold, then check yourself.

## Half-Day Plan (bonus, not explicitly time-boxed above but worth having)

- Read this entire document front-to-back once, unhurried.
- Open VS Code and actually click through every Tier 1 and Tier 2 file:line reference to see the real code — this builds the "name → file → what it does" muscle memory that no amount of reading a summary will give you.
- Re-do the Section 14 mock Q&A cold, timing yourself.
- Skim the full Section 3 master inventory once end-to-end, even if you don't memorize it — the goal is recognition ("oh yes, I've seen that test name before"), not recall.

---

## 14. Mock Manager Questions + Answers

**Easy**

**Q: "Where is the candidate signup test?"**
→ `tests/Candidate/SignUpSignIn.spec.js`, describe block "Candidate Signup - Negative & Edge Cases" for the validation cases, and `P08` near the end of the file (line 461) for the one full happy-path signup→sign-in test.
*Why correct:* directly names the file and the one test that proves the whole flow works.

**Q: "Where do we test document upload?"**
→ `tests/Candidate/Phase2.spec.js`, describe block "Phase 2 - Document Upload - Negative & Edge Cases" (`TC-028` through `TC-032`).
*Why correct:* that's the only describe block touching file uploads in the entire suite.

**Medium**

**Q: "Do we have a test for invalid candidate information?"**
→ Yes, several: `TC-016` (malformed PAN), `TC-017` (malformed mobile), `TC-018` (invalid PIN), `TC-020` (malformed vehicle number) — all in `Phase1.spec.js` — plus `TC-004` (invalid email) and `TC-001/002` (invalid Aadhaar) in `SignUpSignIn.spec.js`.
*Why correct:* shows breadth across multiple fields rather than pointing to just one test.

**Q: "Do we test what happens when a document is missing at submission?"**
→ Yes — `TC-030` (Phase2.spec.js:131): skips the PAN-card upload slot, uploads everything else, and confirms Submit is blocked (zero "Application Submitted" dialogs appear).
*Why correct:* names the exact test and states the concrete assertion, not just "it's tested."

**Q: "Is there a test for unauthorized access to FC Admin?"**
→ Yes — `FCI-04` (Interview.spec.js:219) confirms a restricted account has no "Appointment" item in its sidebar; `INT-72` is the positive counterpart proving a full-access account does.
*Why correct:* gives both halves of the access-control pair, showing you understand it's a positive/negative pair, not one isolated check.

**Hard**

**Q: "How do you know email tests are safe — that we're not spamming a real candidate?"**
→ Point to `INT-27` (PreviewInterviewerEmail.spec.js:76), which explicitly asserts the To field equals `config.EmailId` (the safe test inbox) before any send. Then be upfront: the candidate-side equivalent, `INT-29`, calls the same override function but currently has **no assertion** confirming the value — a known, documented gap, not an active risk (the override is still wired up in code), but worth someone fixing by adding the same `toHaveValue` check `INT-27` has.
*Why correct:* answers with evidence, then proactively discloses the asymmetry instead of overclaiming full coverage.

**Q: "What exactly does the Field Coordinator convention test verify?"**
→ `ONB-DV-08` (DocumentVerification.spec.js:509) confirms the Field Coordinator combobox on HR's Document Verification page accepts and displays "Akshay Gupta" — the standing project convention. It's a UI-interaction check, not a business-rule test; it doesn't verify that *other* names would be rejected.
*Why correct:* precisely scopes what the test does and doesn't cover, rather than overselling it as full validation.

**Very Hard**

**Q: "If Document Verification became accessible to more FC Admin roles, which tests would you expect to update?"**
→ First, name the current contradiction: `config.js` says `akshay.gupta` has no DV sidebar access; project history says that's now false in the live app, and no test checks it either way today. If the requirement formally changes, you'd: (1) add a new access-control test mirroring `FCI-04`/`INT-72` but for Document Verification, logging in as `akshay.gupta` and asserting sidebar presence; (2) revisit `ONB-DV-01`, which today only checks the separate HR account; (3) consider whether `ONB-DV-08`'s Field-Coordinator-selection test needs a role-based variant.
*Why correct:* demonstrates you understand the current gap *and* can reason about downstream test impact, not just recite existing coverage.

**Q: "If the Offer Letter's default email-recipient behavior got fixed, which tests would change?"**
→ `ONB-061` (GenOfferLetter.spec.js:286) currently asserts the *current* (arguably wrong) behavior — that To/CC default to a real internal colleague rather than the candidate. A fix would flip this test's expected value. You'd also want to check `ONB-AL-14` (Appointment Letter), which documents the *opposite* default (defaults to the candidate's own email) — fixing one inconsistently from the other would leave the two letter types behaving differently, so both should probably be reconciled together.
*Why correct:* shows you can trace a hypothetical requirement change to the specific assertion that would need to flip, and flags a related test that a narrow fix might miss.

---

## 15. Final One-Page Revision Sheet

1. **Major modules:** Candidate (public portal) → Interview (FC Admin scheduling/status/emails) → Onboarding (FC Admin grid + separate HR Document Verification + letter generation) → Training (weakest module).
2. **Files per module:** Candidate = `tests/Candidate/*`. Interview = `tests/Interview.spec.js` (grid/access/login/reschedule) + `tests/Interview/*` (setup/status/emails). Onboarding = `tests/Onboarding.spec.js` (grid) + `tests/Onboarding/*` (DocVerification/letters). Training = `tests/Training.spec.js` + `tests/OpenTraining.spec.js`.
3. **Major categories:** Functional/Smoke (structure & happy paths), Validation (mandatory fields, formats), Negative (rejected bad input), Security (injection, access control, email destination), Robustness (refresh, double-click, concurrency), Regression (guards a specific past bug).
4. **Most important tests:** the 20 in Tier 1 (Section 7) — one per module's happy path, plus every real security/access-control test, plus every test tied to a real bug this project found and fixed.
5. **Security/robustness tests live in:** `SignUpSignIn.spec.js` (TC-014), `Interview.spec.js` (FCI-04/INT-72, INT-54), `PreviewInterviewerEmail.spec.js` (INT-27/INT-67), `DocumentVerification.spec.js` (ONB-DV-32, ONB-DV-35, ONB-DV-23/24, ONB-DV-14).
6. **Validation/negative tests live in:** every module has its own cluster — Candidate's Phase1/Phase2 field validations, Interview Setup's form validation, StatusFeedback's mandatory Final Status, Onboarding's Send Back validation.
7. **Important dependencies:** `utils/createFreshInterviewCandidate.js` (Candidate → Interview bridge), `utils/createClearedOnboardingCandidate.js` (→ Onboarding bridge), `utils/Globals.js`'s `ctx.itapNumber` (the only true cross-file global, used fragile-ly by Training).
8. **Major helpers/page objects:** `pages/BasePage.js` (shared verbs), `utils/BrowserFactory.js` (browser/session), `pages/FCAdminLogin.js`'s `ITAP_Login` (shared FC Admin auth), `config.js` (all test data + the critical `EmailId` safe-inbox constant).
9. **Weakest/missing coverage:** Training module (zero assertions, one confirmed-broken test); Apprentice Letter (no happy-path coverage, permanently skipped); the unresolved akshay.gupta/Document-Verification access contradiction; candidate-email destination fix applied but unasserted.
10. **Fastest lookup method:** if you have any native ID (TC-/INT-/ONB-/FCI-/E0x), `Ctrl+Shift+F` it directly — it's unique and appears at the start of the test name. If you only have a scenario description, translate it via Section 6's keyword index first.
