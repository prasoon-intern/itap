# QA Automation Dashboard — Current State, Bugs & Roadmap

This file is scoped to `server.js` + `automation-dashboard.html` (the
"ITAP Automation" test-runner dashboard at `/automation-dashboard`), not the
Playwright suite itself — see the main `README.md` for that.

No code has been changed as part of writing this file. It's a planning
document: what the dashboard already does, what's actively wrong right now,
and ideas for where to take it next for the QA team.

## What it already does

- Six modules in the sidebar (Sign In & Sign Up, Phase 1 & 2, Manager
  Referral, Interview, Onboarding, HR Document Verification), each backed by
  a `PROJECTS` entry in `server.js` with its own test-file filter.
- Per-project or per-test run, with a live checklist and pass/fail status
  streamed over SSE as Playwright's `list` reporter output is parsed
  (`server.js:618` `lineRegex`).
- "Run Everything" chains all projects back-to-back; "Resume" re-runs just
  the leftover tests from a run that was stopped partway through.
- Headed/headless toggle per run.
- Stop button (`taskkill /T /F` on the spawned process).
- History per project, with a downloadable standalone HTML report and a
  screenshot saved for any non-passing test.
- A sidebar health dot per module (green/red/running/none) driven by that
  module's most recent run.

## Bugs / inconsistencies to fix now

These were found by reading `server.js` and `automation-dashboard.html`
against the shared screenshots (the 9/9 Sign In & Sign Up run: 29 stopped,
0 passed, yet the UI reports it as a clean pass).

1. **A stopped run is displayed as "all passed" with a green health dot.**
   Three separate places only check for `failed`/`timedOut` and never
   account for `stopped`:
   - `automation-dashboard.html:891-894` — the "✓ All tests passed on the
     last run" banner only hides on `failing.length` (failed/timedOut
     count), so a run that was stopped before anything ran (0 passed, 0
     failed, 29 stopped) still shows the all-passed banner.
   - `automation-dashboard.html:1004` and `:1186` — the sidebar health dot
     (`projectHealth[id].status`) is `'bad'` only when `failed > 0`,
     otherwise `'good'` — so the same stopped run turns the dot green.
   - Net effect, visible in the shared screenshots: a run with a **0.0%
     pass rate** and **29 Stopped** still shows "✓ All tests passed" and a
     green dot. That's actively misleading for anyone scanning the sidebar
     to decide what needs attention.
   - Fix direction: treat `stopped > 0` (and arguably a `total === 0` empty
     run) as "needs attention," not "good."

2. **Stopped tests get the wrong per-row reason text.** `reasonCell()`
   (`automation-dashboard.html:590-607`, duplicated in
   `buildDownloadableReportHtml` around `:931`) only special-cases
   `status === 'skipped'`. For `status === 'stopped'`, the real reason
   (`"Run was stopped before this test started."`, set server-side in
   `server.js:923`) gets passed through `friendlyReason()`, which was built
   to translate *failure* stack traces — it matches none of the
   `FRIENDLY_REASON_PATTERNS` and falls back to `"This step did not behave
   as expected."` That's exactly what the screenshots show in the REASON
   column for every one of the 29 stopped rows, and it's wrong — nothing
   "misbehaved," the run was simply stopped before that test started.
   Same fix shape as the skip-reason special case already in place: add an
   explicit `status === 'stopped'` branch that shows the real reason as-is.

3. **Manager Referral's project path is hardcoded to one machine.**
   `server.js:50` — `PROJECTS.referral.dir` is a literal
   `"D:\\Itap_automation\\manager-referral-automation"`. The dashboard
   breaks for that module the moment it's run from a different machine or
   that folder moves. Worth making this an env var (e.g.
   `REFERRAL_PROJECT_DIR`) with the current path as a fallback default.

4. **Real credentials and a real monitored inbox are committed in
   `config.js`.** FC Admin login (`akshay.gupta` / password), HR login
   (`nimisha` / password), and `EmailId` are plain text in a tracked file.
   Fine for a small, trusted team on a private repo today, but worth moving
   to a gitignored `.env` (or at least a `config.local.js` pattern) before
   this dashboard/repo is shared more widely.

5. **No auth on the dashboard or its API.** Anyone who can reach port 3000
   can start a run — including ones that send real emails (Onboarding
   letters go to `config.EmailId` for real). Low risk while it's only
   reachable on localhost/one machine; worth a basic guard before it's ever
   exposed on a shared network path.

6. **Single global run lock.** `currentRun`/`runReservation` allow exactly
   one run across *all* projects at a time — if a second QA teammate (or a
   second browser tab) tries to start a run while one is in progress, they
   just get a 409. Fine for one person today; worth knowing about before
   more than one person uses this dashboard at once.

## Feature ideas for the QA team (not started, for discussion)

### Reporting & visibility
- A trend view per module — pass % over the last N runs — instead of only
  a flat "Recent Runs" list, so a QA lead can see a module getting flakier
  over time at a glance.
- Flaky-test flagging: surface tests whose status flips between
  consecutive runs of the same suite, since those are the ones worth
  triaging first.
- A diff view between two runs — "newly failing since last run" / "newly
  fixed" — instead of re-reading two full tables side by side.
- Run-completion notifications (Slack/Teams/email), since nobody watches
  the dashboard for the full run duration, especially the ~3-minute
  candidate-creation-heavy runs.
- "Export history to Excel" — the project already depends on `exceljs` and
  has `excelReporter.js`; the same approach could back a one-click export
  of a project's run history for status reporting to stakeholders.

### Run control
- Turn the P/N/E category badges (already computed client-side in
  `assignCategoryIds`) into real filter chips, so a QA member can run "just
  the negative cases" without hand-picking checkboxes.
- Run independent modules in parallel (e.g. Manager Referral and Sign In
  share no state) instead of always serially in "Run Everything," to cut
  wall-clock time.
- "Retry failed only" — rerun just the failed subset of the last run.
- Scheduled/nightly runs so results are waiting in the morning rather than
  needing someone to kick off "Run Everything" by hand.
- An environment selector (dev/staging/prod URL + credentials) instead of
  the single hardcoded set in `config.js`.

### Collaboration & traceability
- A "known issue" / owner annotation per test case, so a recurring known
  failure doesn't need re-triage on every run.
- A free-text note per run ("environment was down," "data issue, not a
  regression") attached to the history entry, visible next to that run
  later.
- A link from each TC ID to wherever the QA team already tracks test
  cases/bugs (Jira, Excel, etc.) — depends on what's actually in use.

### Dashboard robustness
- Basic auth in front of the Express app.
- Config for run-affecting values (project dirs, port) via `.env` instead
  of literals in `server.js`.
- A run queue instead of a single global lock, if more than one person
  ends up using this at the same time.

---

Next step: pick which of the bugs and features above actually matter for
how the QA team works day to day, then implement in priority order.
