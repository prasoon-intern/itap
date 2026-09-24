const express = require("express");
const { exec, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const reportsDir = path.join(__dirname, "run-reports");

// ---- Test Runner Dashboard: storage locations ----------------------------
const historyDir = path.join(__dirname, "dashboard-history");
const screenshotsDir = path.join(__dirname, "dashboard-screenshots");
[historyDir, screenshotsDir].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Every spawned command below uses PROJECTS[id].dir as its cwd rather than
// a hardcoded __dirname reference, so a project living elsewhere could
// still resolve its own local Playwright install if it ever needed to.
// "referral" (Manager Referral) used to point at a separate folder on a
// different drive with no code in this repo at all
// (D:\Itap_automation\manager-referral-automation) - that folder never
// existed on this machine, which is why "Run" on this module always failed
// with "Unexpected end of JSON input" (empty `--list` output from a
// nonexistent directory). Rebuilt in-repo (2026-09-14) as
// tests/ManagerReferral/*.spec.js, matching every other module.
//
// Candidate-facing tests live under tests/Candidate/ (see pages/Candidate/ and
// tests/Candidate/ — one file per feature cluster: SignIn.spec.js,
// SignUp.spec.js, Phase1.spec.js, and Phase2.spec.js). The former end-to-end
// "Full Candidate Flow" file was removed (2026-09-02) — createFreshInterviewCandidate.js
// already covers getting a fresh candidate through signup/Phase 1/Phase 2
// for every other module, so the standalone 58-step E2E duplicate wasn't
// needed. The dashboard splits the 4 remaining files into two logical
// projects, purely by file now (no more title/describe parsing needed):
// - "signin": SignIn.spec.js and SignUp.spec.js.
// - "phase1phase2": Phase1.spec.js and Phase2.spec.js.
//
// SignIn.spec.js/SignUp.spec.js (2026-09-16) replaced the old, single
// SignUpSignIn.spec.js — that file's ad-hoc TC-XXX/E-XX/P-XX ids weren't
// traceable to any Excel sheet at all. The two new files are built from
// Test Cases/candidateSignInSignUp.xlsx (split out of ManagerReferral_TestCases.xlsx's
// CandidateAuth_TestCases sheet, which never belonged bundled in there),
// matching the same Excel-traceable "// Excel TC_XX" convention as
// ManagerReferral's own Page.spec.js/Report.spec.js. This dropped the old
// file's Forgot Password/concurrency/double-click/refresh-safety coverage,
// none of which exists in the new sheet yet — a deliberate scope choice, not
// an oversight; the old page-object methods for that coverage are still
// there in pages/Candidate/SignUpSignIn.js if it's added back later.
const PROJECTS = {
    signin: {
        id: "signin",
        label: "Candidate Sign In & Sign Up",
        description: "Candidate authentication: Sign In and Sign Up field validations, built from candidateSignInSignUp.xlsx.",
        dir: __dirname,
        testFilter: (t) => t.file === "Candidate/SignIn.spec.js" || t.file === "Candidate/SignUp.spec.js",
    },
    phase1phase2: {
        id: "phase1phase2",
        label: "Candidate Application Form — Phase 1 & Phase 2",
        // Sidebar nav renders this via innerHTML specifically so the <br>
        // below works (see automation-dashboard.html's renderSidebar) - every
        // OTHER place project.label is used (page header, banners, exported
        // report title) reads the plain single-line `label` above instead,
        // since those use textContent or escapeHtml() where a literal <br>
        // would show up as broken raw text rather than an actual line break.
        sidebarLabel: "Candidate Application Form<br>Phase 1 & Phase 2",
        description: "Personal Details, Qualification, Experience Details, and Document Upload coverage — happy-path plus negative/edge cases.",
        dir: __dirname,
        // Phase 2 is deferred (user, 2026-09-18: "not working on phase 2 right
        // now") - temporarily excluded from the dashboard so its legacy tests
        // don't show up alongside Phase 1's real, verified ones. Re-add
        // `|| t.file === "Candidate/Phase2.spec.js"` when Phase 2 reopens.
        testFilter: (t) => t.file === "Candidate/Phase1.spec.js",
    },
    referral: {
        id: "referral",
        label: "Manager Referral",
        description: "Positive, Negative, and Edge coverage for the Manager Referral form and report page.",
        dir: __dirname,
        testFilter: (t) => t.file === "ManagerReferral/Page.spec.js" || t.file === "ManagerReferral/Report.spec.js",
    },
    interview: {
        id: "interview",
        label: "FC Admin - Interview Module",
        description: "Appointment > Interview: page structure & filters, Schedule Interview form validation, Re-Schedule Interview validation, FC Admin login, Candidate Status Update save-flow, and the full schedule -> email -> status -> feedback -> final-status flow.",
        dir: __dirname,
        // The 11 original describe.serial blocks are now spread across 4 files
        // (2026-09-02 split, matching the same one-file-per-cluster treatment
        // Candidate got): tests/Interview.spec.js keeps Re-Schedule Interview,
        // Access Control, Login, and Grid/Filters (unsplit so far); Setup.js,
        // StatusFeedback.js, and Process.js live under tests/Interview/.
        testFilter: (t) => t.file === "Interview.spec.js" || t.file.startsWith("Interview/"),
    },
    onboarding: {
        id: "onboarding",
        label: "FC Admin - Onboarding Module",
        description: "Appointment > Onboarding: page structure & grid filters, Export To Excel, Document Status popup, the full Gen Offer Letter flow, and the full Gen Appointment Letter flow - all real sends going to config.EmailId only. Gen Apprentice Letter's negative gates (experienced-candidate block, non-MCPPL-division block) are covered; its positive path is skipped pending an MCPPL-division ManagerRefID.",
        dir: __dirname,
        // The 6 describe.serial blocks were spread across 5 files (2026-09-02
        // split, matching the same one-file-per-cluster treatment Interview
        // got): tests/Onboarding.spec.js keeps Document Status Popup and Page
        // Structure/Grid & Filters (unsplit, grid-only); Gen Offer Letter, Gen
        // Appointment Letter, and Gen Apprentice Letter live under
        // tests/Onboarding/. Document Verification moved out to its own "hr"
        // project below (2026-09-08) - it's a distinct HR-only portal, not an
        // FC Admin page, so it no longer belongs under this module at all.
        testFilter: (t) => t.file === "Onboarding.spec.js" || t.file.startsWith("Onboarding/"),
    },
    hr: {
        id: "hr",
        label: "HR - Document Verification",
        description: "The HR (nimisha) role's Document Verification portal - a separate page from the FC Admin Onboarding grid, reached via its own sidebar item: Verification Pending/Completed tabs, per-document Verify checkboxes, Field Coordinator selection, and the Verify confirmation flow. Split out of the Onboarding module (2026-09-08) since it's HR-only, not FC Admin.",
        dir: __dirname,
        testFilter: (t) => t.file.startsWith("HR/"),
    },
};

// Every describe.serial block in tests/Interview.spec.js that needs its own
// fresh candidate creates one directly via utils/createFreshInterviewCandidate.js
// in its own beforeAll, instead of depending on a shared prereq injected here.
// That old approach only ever produced ONE shared candidate
// per run, which the earliest-running file (alphabetically) would consume,
// leaving every other candidate-dependent file with nothing and cascading
// to failures/skips once more than one such file existed - confirmed live
// 2026-08-26 as the cause of "Run All" showing ~90 skipped tests. Each file
// being fully self-sufficient means "Run All" now works correctly
// regardless of how many files need their own candidate, at the cost of
// more candidate-creation cycles (~3 min each) per full run.

app.use(express.json());

app.use(express.static(__dirname));
app.use("/dashboard-screenshots", express.static(screenshotsDir));
app.use("/report/signin", express.static(path.join(PROJECTS.signin.dir, "playwright-report")));
app.use("/report/phase1phase2", express.static(path.join(PROJECTS.phase1phase2.dir, "playwright-report")));
app.use("/report/referral", express.static(path.join(PROJECTS.referral.dir, "playwright-report")));
app.use("/report/interview", express.static(path.join(PROJECTS.interview.dir, "playwright-report")));
app.use("/report/onboarding", express.static(path.join(PROJECTS.onboarding.dir, "playwright-report")));
app.use("/report/hr", express.static(path.join(PROJECTS.hr.dir, "playwright-report")));

app.get("/", (req, res) => {
    // index.html (the old flowConfig.json-driven scenario picker) was removed
    // 2026-09-02 - its /run endpoint had become a silent no-op once the E2E
    // flow files it drove (Candidate/FullFlow.spec.js, Interview/Process.spec.js)
    // were deleted as redundant duplicates. /automation-dashboard is the
    // actively-used, fully-functional dashboard now.
    res.redirect("/automation-dashboard");
});

app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "dashboard.html"));
});

app.get("/test-runner", (req, res) => {
    res.sendFile(path.join(__dirname, "test-runner.html"));
});

app.get("/automation-dashboard", (req, res) => {
    // Without this, sendFile() sets only Last-Modified/ETag - browsers can
    // still serve a stale cached copy of this file without even revalidating,
    // which is exactly what happened live (2026-09-16): a fix to this file's
    // own client-side logic (belongsToProject) didn't take effect in an
    // already-open browser tab even after the server was restarted, because
    // the browser never re-fetched it at all. Forces a fresh fetch (with
    // conditional-GET revalidation still allowed) every time this page loads.
    res.set("Cache-Control", "no-cache");
    res.sendFile(path.join(__dirname, "automation-dashboard.html"));
});

app.get("/api/projects", (req, res) => {
    res.json({ ok: true, projects: Object.values(PROJECTS) });
});

function ensureReportsDir() {
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }
}

function readScenarioReports() {
    ensureReportsDir();

    // Matches only real scenario-report filenames (R<runId>-S<seq>.json, e.g.
    // R20260817101224-S001.json) - NOT dailyCandidateCounter.json, which also
    // lives in this directory (utils/DailyCandidateNaming.js's own counter
    // state, shape { date, count }, no runId/createdAt/summary fields at
    // all). A blanket "*.json" filter picked that file up too, producing a
    // report with an undefined runId that crashed /api/runs's sort
    // (`b.runId.localeCompare(a.runId)` on undefined) - confirmed live
    // 2026-09-02.
    return fs.readdirSync(reportsDir)
        .filter((file) => /^R\d+-S\d+\.json$/.test(file))
        .map((file) => {
            const filePath = path.join(reportsDir, file);
            const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
            return { ...data, sourceFile: file };
        });
}

app.get("/api/runs", (req, res) => {
    try {
        const scenarioReports = readScenarioReports();
        const runs = new Map();

        for (const report of scenarioReports) {
            const existing = runs.get(report.runId) || {
                runId: report.runId,
                createdAt: report.createdAt,
                scenarioCount: 0,
                passed: 0,
                failed: 0,
                skipped: 0,
            };

            existing.scenarioCount += 1;
            existing.passed += report.summary?.passed || 0;
            existing.failed += report.summary?.failed || 0;
            existing.skipped += report.summary?.skipped || 0;
            runs.set(report.runId, existing);
        }

        const response = Array.from(runs.values()).sort((a, b) => b.runId.localeCompare(a.runId));
        res.json({ ok: true, runs: response });
    } catch (error) {
        res.status(500).json({ ok: false, message: error.message });
    }
});

app.get("/api/runs/:runId", (req, res) => {
    try {
        const scenarioReports = readScenarioReports().filter((report) => report.runId === req.params.runId);
        scenarioReports.sort((a, b) => (a.reportSheetName || "").localeCompare(b.reportSheetName || ""));
        res.json({ ok: true, runId: req.params.runId, scenarios: scenarioReports });
    } catch (error) {
        res.status(500).json({ ok: false, message: error.message });
    }
});


// ============================================================================
// Test Runner Dashboard
//
// Lets a user browse every individual Playwright test, run one/many/all of
// them on demand, watch live pass/fail status and logs without touching a
// terminal, stop a run in progress, and review history (with per-test
// duration and a saved screenshot for any failure) afterward.
// ============================================================================

let currentRun = null; // { proc, runId, startedAt, order: [key,...], results: Map(key -> {status,duration}), tests: [...] }
// Reserves the single "a run is in progress" slot the INSTANT a request is
// accepted, synchronously, before the async test-listing step that used to
// leave a multi-second gap during which currentRun was still null. Without
// this, two nearly-simultaneous run requests (e.g. an impatient double-click
// on "Run All" while the dashboard gives no feedback during that listing
// step) could both pass the "if (currentRun)" check below before either one
// actually set currentRun, resulting in two concurrent Playwright processes
// silently fighting over the same currentRun object - confirmed as a real
// gap while auditing this run-start path (2026-09-09).
let runReservation = false;
const sseClients = new Set();

function testKey(file, line) {
    return `${path.basename(file)}:${line}`;
}

function safeFileName(text) {
    return String(text).replace(/[^a-z0-9\-_. ]/gi, "_").slice(0, 120);
}

function broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of sseClients) {
        try {
            res.write(payload);
        } catch (e) {
            sseClients.delete(res);
        }
    }
}

function parseDuration(text) {
    if (!text) return 0;
    const trimmed = text.trim();
    if (trimmed.endsWith("ms")) return parseFloat(trimmed);
    if (trimmed.endsWith("m")) return parseFloat(trimmed) * 60000;
    if (trimmed.endsWith("s")) return parseFloat(trimmed) * 1000;
    return 0;
}

function listAllTests(projectDir, testFilter) {
    return new Promise((resolve, reject) => {
        exec(
            "npx playwright test --list --reporter=json",
            { cwd: projectDir, maxBuffer: 32 * 1024 * 1024 },
            (error, stdout, stderr) => {
                try {
                    const data = JSON.parse(stdout);
                    const tests = [];

                    function walk(suite, describePath) {
                        const nextPath =
                            suite.line > 0 && suite.title ? [...describePath, suite.title] : describePath;
                        for (const spec of suite.specs || []) {
                            const line = spec.line;
                            const file = spec.file;
                            const test = {
                                key: testKey(file, line),
                                file,
                                line,
                                title: spec.title,
                                describe: nextPath.join(" > "),
                            };
                            // Restricts a project's test list to just its own tests
                            // when it shares its "dir" with another project (e.g.
                            // phase1phase2 and signin both use the repo root) — can
                            // filter by file, since signin (SignIn.spec.js/SignUp.spec.js) and
                            // phase1phase2 (Phase1.spec.js/Phase2.spec.js) are now
                            // separate files rather than describe blocks within one file.
                            if (testFilter && !testFilter(test)) continue;
                            tests.push(test);
                        }
                        for (const child of suite.suites || []) walk(child, nextPath);
                    }

                    for (const top of data.suites || []) walk(top, []);
                    resolve(tests);
                } catch (parseError) {
                    reject(new Error(`Failed to list tests: ${parseError.message} | stderr: ${stderr || ""}`));
                }
            }
        );
    });
}

function getProjectOr400(req, res) {
    const projectId = req.query.project || req.body.project;
    const project = PROJECTS[projectId];
    if (!project) {
        res.status(400).json({ ok: false, message: `Unknown project "${projectId}". Expected one of: ${Object.keys(PROJECTS).join(", ")}` });
        return null;
    }
    return project;
}

// Listing tests shells out to "npx playwright test --list", which takes
// several seconds (spawning a full Playwright CLI process just to discover
// spec files). Cache the result per project so page loads are instant; only
// pay that cost again when explicitly asked to refresh.
const testListCache = {};

// Separate from testListCache (which is keyed per-project and respects each
// project's own testFilter) — this one is keyed by directory and always
// unfiltered, so ATOMIC_SERIAL_GROUPS expansion can find every test in a
// shared file regardless of which project's scoped view triggered the run.
const unfilteredTestListCache = {};
async function getUnfilteredTests(dir) {
    if (!unfilteredTestListCache[dir]) {
        unfilteredTestListCache[dir] = await listAllTests(dir, null);
    }
    return unfilteredTestListCache[dir];
}

app.get("/api/tests", async (req, res) => {
    const project = getProjectOr400(req, res);
    if (!project) return;
    try {
        if (!testListCache[project.id] || req.query.refresh === "true") {
            testListCache[project.id] = await listAllTests(project.dir, project.testFilter);
        }
        res.json({ ok: true, tests: testListCache[project.id] });
    } catch (error) {
        res.status(500).json({ ok: false, message: error.message });
    }
});

app.get("/api/run-status", (req, res) => {
    if (!currentRun) return res.json({ ok: true, running: false });
    res.json({
        ok: true,
        running: true,
        project: currentRun.project,
        runId: currentRun.runId,
        startedAt: currentRun.startedAt,
        results: Array.from(currentRun.results.entries()).map(([key, value]) => ({ key, ...value })),
    });
});

app.get("/api/stream", (req, res) => {
    res.set({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
    });
    res.flushHeaders();
    sseClients.add(res);

    // Lets a (re)connecting client - a fresh page load, or the browser's
    // automatic EventSource reconnect after a network blip - resync to
    // whatever is actually running on the server right now, instead of
    // defaulting to "nothing is running" until the next incidental
    // 'status'/'run-complete' event happens to arrive. The client previously
    // never listened for this event at all, so opening or refreshing the
    // dashboard mid-run showed a fully idle UI (no live panel, Run
    // All/Stop buttons not reflecting the busy state, sidebar dot wrong)
    // for as long as it took the next per-test event to land - and since
    // the buttons looked enabled, it let a user start a second, conflicting
    // run against the same project. Carries the same shape as "run-start"
    // (testCount/tests/startedAt) plus the current results, so the client
    // can rebuild its runState exactly as if it had been there from the start.
    res.write(
        `event: hello\ndata: ${JSON.stringify({
            running: !!currentRun,
            project: currentRun ? currentRun.project : null,
            runId: currentRun ? currentRun.runId : null,
            testCount: currentRun ? currentRun.order.length : 0,
            tests: currentRun ? currentRun.requested : [],
            startedAt: currentRun ? currentRun.startedAt : null,
            results: currentRun ? Array.from(currentRun.results.entries()).map(([key, value]) => ({ key, ...value })) : [],
        })}\n\n`
    );

    req.on("close", () => sseClients.delete(res));
});

app.get("/api/history", (req, res) => {
    const projectFilter = req.query.project; // optional
    try {
        const files = fs
            .readdirSync(historyDir)
            .filter((f) => f.endsWith(".json") && !f.startsWith("_"));
        let items = files.map((f) => JSON.parse(fs.readFileSync(path.join(historyDir, f), "utf8")));
        if (projectFilter) items = items.filter((r) => r.project === projectFilter);
        items.sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""));
        res.json({ ok: true, history: items });
    } catch (error) {
        res.status(500).json({ ok: false, message: error.message });
    }
});

// Starts one project's Playwright run and wires up all the existing live-status
// plumbing (currentRun, SSE broadcasts, stdout/stderr parsing). Extracted out of
// the /api/run-tests route so /api/run-full-suite can also drive it, one project
// at a time, awaiting each one's completion before starting the next.
function startProjectRun(project, requestedTests, wantHeadless) {
    return new Promise((resolve, reject) => {
        if (currentRun || runReservation) {
            reject(new Error("A test run is already in progress."));
            return;
        }
        // Claimed synchronously, right here, before any "await" below runs -
        // closes the race window described above. Released in the catch at
        // the bottom of this async block on any failure, or implicitly
        // superseded once currentRun itself is set a few lines before the
        // process actually spawns.
        runReservation = true;

        (async () => {
            try {
                let allTests;
                try {
                    // Always fetch a fresh list before starting a run - NOT the
                    // "only if missing" pattern /api/tests uses for fast page
                    // loads. Confirmed live (2026-09-04): if test files are
                    // edited on disk after the cache first populated (e.g. new
                    // tests inserted, shifting later tests' line numbers),
                    // run.order below still gets built from the STALE cached
                    // file:line keys. finalizeRun()'s "fill in anything
                    // requested but missing" step then can't find those stale
                    // keys in the real Playwright report (which reflects the
                    // actual current file) and injects a phantom "skipped" row
                    // for every one of them - inflating a 97-real-test project
                    // to a reported 159 total/66 skipped, even though every
                    // real test had actually passed. A few extra seconds of
                    // `--list` overhead per run is worth it for correctness.
                    testListCache[project.id] = await listAllTests(project.dir, project.testFilter);
                    allTests = testListCache[project.id];
                } catch (error) {
                    runReservation = false;
                    reject(error);
                    return;
                }

                // Some describe.serial blocks are one continuous chain where every
                // step depends on the previous one having already run in the same
                // browser session — picking a partial selection from partway through
                // (e.g. just "Select Interviewer" onward, skipping login/search)
                // leaves the browser stuck on an earlier screen forever, since the
                // steps before it never ran, and the selected test then times out
                // waiting for something that was never reached (confirmed live).
                // The 11 original describe.serial blocks are independent of each
                // other (each creates its own fresh candidate), so a partial
                // selection only needs expanding to its own block, not the others -
                // now spread across 4 files (2026-09-02 split): tests/Interview.spec.js
                // (Re-Schedule Interview, Access Control, Login, Grid/Filters) and
                // tests/Interview/{Setup,PreviewInterviewerEmail,PreviewCandidateEmail,
                // StatusFeedback}.spec.js for the rest (Process.spec.js, the former
                // single-continuous-chain E2E file, was removed 2026-09-02 as a
                // redundant duplicate of these independent files' coverage).
                // Silently expand any partial selection to the full describe.serial
                // block it belongs to.
                const ATOMIC_SERIAL_GROUPS = [
                    { file: "Interview.spec.js", describe: "FC Admin - Re-Schedule Interview" },
                    { file: "Interview/Setup.spec.js", describe: "FC Admin - Schedule Interview Form Validation" },
                    { file: "Interview.spec.js", describe: "FC Admin - Interview Access Control" },
                    { file: "Interview/PreviewInterviewerEmail.spec.js", describe: "FC Admin - Preview Interviewer Email Validation" },
                    { file: "Interview/PreviewCandidateEmail.spec.js", describe: "FC Admin - Preview Candidate Email Validation" },
                    { file: "Interview/StatusFeedback.spec.js", describe: "FC Admin - Feedback Capture Validation" },
                    { file: "Interview/StatusFeedback.spec.js", describe: "FC Admin - Final Status Validation (Rejected path)" },
                    { file: "Interview.spec.js", describe: "FC Admin - Login" },
                    { file: "Interview/Setup.spec.js", describe: "FC Admin - Multi-Candidate Batch Scheduling" },
                    { file: "Interview/Setup.spec.js", describe: "FC Admin - Schedule Interview Edge Cases" },
                    { file: "Interview/StatusFeedback.spec.js", describe: "FC Admin - Candidate Status Update" },
                    { file: "Interview.spec.js", describe: "FC Admin - Interview Grid: Page Structure & Filters" },
                    { file: "Onboarding.spec.js", describe: "FC Admin - Onboarding: Document Status Popup" },
                    { file: "Onboarding.spec.js", describe: "FC Admin - Onboarding: Page Structure, Grid & Filters" },
                    { file: "HR/DocumentVerification.spec.js", describe: "HR - Document Verification" },
                    { file: "HR/DocumentVerification.spec.js", describe: "HR - Document Verification - Robustness & Security" },
                    { file: "Onboarding/GenOfferLetter.spec.js", describe: "FC Admin - Onboarding: Gen Offer Letter" },
                    { file: "Onboarding/GenAppointmentLetter.spec.js", describe: "FC Admin - Onboarding: Gen Appointment Letter" },
                    { file: "Onboarding/GenApprenticeLetter.spec.js", describe: "FC Admin - Onboarding: Gen Apprentice Letter" },
                ];
                // requestedTests comes straight from the client's JSON body, which
                // only ever carries {file, line} (confirmed in
                // automation-dashboard.html's own runAllBtn handler: `.map((t) =>
                // ({ file: t.file, line: t.line }))`) - it never has `describe`.
                // inGroup() needs describe to match ATOMIC_SERIAL_GROUPS, so look
                // each requested test up in allTests (which does carry describe)
                // first. Without this, `t.describe === g.describe` was always
                // `undefined === "some string"` -> always false -> selectedGroups
                // was always empty -> the entire atomic-group expansion below was
                // dead code for every project, not just this one - a partial
                // selection from the middle of ANY describe.serial block (e.g.
                // picking just one Document Verification or Interview-scheduling
                // test) ran as-is instead of being expanded to the full serial
                // chain it depends on, exactly the failure mode this was built to
                // prevent (confirmed live 2026-09-07 while verifying the newly
                // expanded Document Verification suite runs correctly from the
                // dashboard).
                const testMetaByKey = new Map(allTests.map((t) => [testKey(t.file, t.line), t]));
                const requestedWithDescribe = requestedTests.map((t) => testMetaByKey.get(testKey(t.file, t.line)) || t);

                const inGroup = (t, g) => t.file === g.file && t.describe === g.describe;
                let effectiveRequestedTests = requestedWithDescribe;
                if (requestedWithDescribe.length > 0) {
                    const selectedGroups = ATOMIC_SERIAL_GROUPS.filter((g) =>
                        requestedWithDescribe.some((t) => inGroup(t, g))
                    );
                    if (selectedGroups.length > 0) {
                        // allTests is this *project's* filtered view, which may not
                        // contain every test in the atomic group if a project's
                        // testFilter excludes some of them. Expanding from that
                        // filtered list would reproduce the exact bug this is meant
                        // to fix. Fetch the true, unfiltered list for this file
                        // instead, so the expansion is complete.
                        const otherSelections = requestedWithDescribe.filter((t) => !selectedGroups.some((g) => inGroup(t, g)));
                        const unfilteredTests = await getUnfilteredTests(project.dir);
                        const expandedAtomicSelections = unfilteredTests.filter((t) =>
                            selectedGroups.some((g) => inGroup(t, g))
                        );
                        effectiveRequestedTests = [...otherSelections, ...expandedAtomicSelections];
                    }
                }

                const runAll = requestedTests.length === 0;
                const order = runAll
                    ? allTests.map((t) => t.key)
                    : effectiveRequestedTests.map((t) => testKey(t.file, t.line));

                // Explicitly target this project's own file(s) even for "Run All" —
                // previously this was an empty array, which let Playwright fall back to
                // its own default discovery (every spec file under testDir) instead of
                // just the files this project actually claims to cover.
                let targets = runAll
                    ? [...new Set(allTests.map((t) => `tests/${t.file}`))]
                    : effectiveRequestedTests.map((t) => `tests/${t.file}:${t.line}`);

                // Each describe.serial block in Interview.spec.js that needs its own
                // candidate creates one directly (utils/createFreshInterviewCandidate.js,
                // called from its own beforeAll) instead of depending on a shared
                // prereq injected here — this used to inject a separate candidate-setup
                // file plus the full candidate-signup flow once per run, but that only
                // ever produced ONE shared candidate, which the earliest-running block
                // would consume, leaving every other candidate-dependent block with
                // nothing and cascading to failures/skips. See project memory for the
                // 2026-08-26 fix.
                let prereqInjected = false;

                const runId = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
                const headedFlag = wantHeadless ? "" : " --headed";
                const jsonOut = path.join(historyDir, `_last-run-${project.id}-${runId}.json`);
                // Include "html" alongside list/json so the "Full Playwright Report" link
                // actually reflects this run, not whatever the project's html reporter
                // last produced (previously it never ran here at all, since the CLI
                // --reporter flag fully replaces the project's own config, and this
                // spawn only ever asked for list+json).
                const cmd = `npx playwright test ${targets.join(" ")} --reporter=list,json,html${headedFlag}`.trim();

                const testMeta = new Map(allTests.map((t) => [t.key, t]));
                const results = new Map(order.map((key) => [key, { status: "queued", duration: 0 }]));
                if (order.length) results.set(order[0], { status: "running", duration: 0 });

                const proc = spawn(cmd, {
                    cwd: project.dir,
                    shell: true,
                    env: {
                        ...process.env,
                        PLAYWRIGHT_JSON_OUTPUT_NAME: jsonOut,
                        // signin/phase1phase2's tests manage their own browser via
                        // BrowserFactory (which checks this env var directly) rather
                        // than Playwright's own fixture-provided browser, so the
                        // --headed CLI flag above has no effect on them at all —
                        // this is what actually makes the dashboard's per-run
                        // headless toggle take effect for those tests.
                        HEADLESS: wantHeadless ? "true" : "false",
                        // Stops the html reporter from trying to auto-open a browser
                        // window on this machine once the run finishes (its default
                        // "open" behavior is suppressed when Playwright detects CI).
                        CI: "1",
                    },
                });

                currentRun = {
                    proc,
                    project: project.id,
                    runId,
                    startedAt: new Date().toISOString(),
                    order,
                    results,
                    requested: order.map((key) => testMeta.get(key)).filter(Boolean),
                };
                runReservation = false; // currentRun itself now guards the "already running" slot

                broadcast("run-start", { project: project.id, runId, testCount: order.length, tests: currentRun.requested, prereqInjected });
                if (prereqInjected) {
                    broadcast("log", {
                        stream: "stdout",
                        line: "=== Preparing a fresh test candidate first (required so the Interview module has a real, schedulable candidate to work with) — this runs the full candidate signup flow before any Interview module test starts. ===",
                    });
                }

                let lineBuffer = "";
                // Playwright's list reporter marks each line with "ok"/"x" only when
                // it decides the terminal can't render UTF-8 (plain win32 console,
                // no VS Code/Windows Terminal); otherwise (confirmed live: this
                // dashboard is normally started from a VS Code integrated terminal,
                // which sets TERM_PROGRAM=vscode) it uses the Unicode "✓"/"✘" marks
                // instead - see node_modules/playwright/lib/reporters/list.js. The
                // old regex only ever matched "ok"/"x", so in the common case here
                // it silently matched zero lines all run long: no per-test "status"
                // events ever fired, and the dashboard's live counter just sat on
                // "1 of N" from run-start until run-complete jumped straight to the
                // final count - exactly the "waits until the whole suite finishes"
                // failure mode this live counter exists to avoid. Matching both
                // mark styles fixes that regardless of which terminal started the
                // server.
                const lineRegex = /^\s*(ok|x|✓|✘)\s+\d+\s+\[chromium\]\s+›\s+(\S+):(\d+):(\d+)\s+›\s+(.+?)\s+\(([\d.]+\s*m?s)\)\s*$/;
                // eslint-disable-next-line no-control-regex
                const ansiRegex = /\x1b\[[0-9;]*m/g;

                function handleChunk(chunk, stream) {
                    // Trailing buffered stdout/stderr chunks can still arrive
                    // after the process's "close" event already fired and
                    // finalizeRun() already cleared currentRun - guard against
                    // that race instead of crashing the whole server on it.
                    if (!currentRun) return;

                    const text = chunk.toString();
                    lineBuffer += text;
                    const lines = lineBuffer.split(/\r?\n/);
                    lineBuffer = lines.pop(); // keep incomplete trailing line for next chunk

                    for (const rawLineWithAnsi of lines) {
                        const rawLine = rawLineWithAnsi.replace(ansiRegex, "");
                        if (!rawLine.trim()) continue;
                        broadcast("log", { stream, line: rawLine });

                        const match = rawLine.match(lineRegex);
                        if (match) {
                            const [, mark, file, line, , , durationText] = match;
                            const key = testKey(file, parseInt(line, 10));
                            const status = (mark === "ok" || mark === "✓") ? "passed" : "failed";
                            const duration = parseDuration(durationText);
                            currentRun.results.set(key, { status, duration });
                            broadcast("status", { key, status, duration });

                            const idx = currentRun.order.indexOf(key);
                            if (idx >= 0 && idx + 1 < currentRun.order.length) {
                                const nextKey = currentRun.order[idx + 1];
                                currentRun.results.set(nextKey, { status: "running", duration: 0 });
                                broadcast("status", { key: nextKey, status: "running", duration: 0 });
                            }
                        }
                    }
                }

                proc.stdout.on("data", (chunk) => handleChunk(chunk, "stdout"));
                proc.stderr.on("data", (chunk) => handleChunk(chunk, "stderr"));

                const completion = new Promise((resolveCompletion) => {
                    proc.on("close", (code) => {
                        finalizeRun(project.id, runId, jsonOut, code)
                            .catch((e) => {
                                broadcast("log", { stream: "stderr", line: `Finalize error: ${e.message}` });
                            })
                            .finally(resolveCompletion);
                    });
                });

                resolve({ runId, testCount: order.length, completion });
            } catch (error) {
                // Catches anything past the listAllTests try/catch above that
                // could still throw (e.g. getUnfilteredTests() during
                // ATOMIC_SERIAL_GROUPS expansion) - previously an exception
                // here became an unhandled rejection inside this detached
                // async IIFE, never reaching the outer Promise's resolve/
                // reject at all, so the original /api/run-tests request
                // would simply hang forever instead of getting an error
                // response, and the reservation below would never clear.
                runReservation = false;
                reject(error);
            }
        })();
    });
}

app.post("/api/run-tests", async (req, res) => {
    const project = getProjectOr400(req, res);
    if (!project) return;

    const requestedTests = Array.isArray(req.body.tests) ? req.body.tests : [];
    // Per-run headless toggle from the dashboard takes precedence over the
    // server's HEADLESS env var (which remains the default when omitted).
    const wantHeadless = typeof req.body.headless === "boolean" ? req.body.headless : process.env.HEADLESS === "true";

    try {
        const { runId, testCount, completion } = await startProjectRun(project, requestedTests, wantHeadless);
        res.json({ ok: true, runId, testCount });
        completion.catch(() => {}); // errors are already broadcast over SSE
    } catch (error) {
        const status = /already in progress/.test(error.message) ? 409 : 500;
        res.status(status).json({ ok: false, message: error.message });
    }
});

// Runs every project's full test list back-to-back: Manager Referral, then
// Sign In & Sign Up, then Phase 1 & Phase 2 — the same order they appear in
// the sidebar. Reuses startProjectRun so each project's tests still show up
// individually in the existing per-project history/health tracking; this
// just chains three normal runs instead of introducing a separate code path.
const FULL_SUITE_ORDER = ["referral", "signin", "phase1phase2"];
let fullSuiteRunning = false;
let fullSuiteStopRequested = false;
// What the "Resume" button re-runs: null when the last run finished cleanly
// (nothing left to pick back up), otherwise either a single project's
// leftover tests or a full-suite run's leftover tests + untouched projects.
// Populated in finalizeRun(), consumed (and cleared) by /api/resume.
let lastStopPoint = null;

// Drives a sequence of project runs back-to-back, one at a time, broadcasting
// the same full-suite-* events regardless of whether this is a fresh
// "Run Everything" (every step is "run all") or a resume (the first step may
// be a specific leftover test list, the rest "run all" for untouched projects).
async function runProjectSequence(steps, wantHeadless) {
    fullSuiteRunning = true;
    fullSuiteStopRequested = false;
    broadcast("full-suite-start", { order: steps.map((s) => ({ id: s.projectId, label: PROJECTS[s.projectId].label })) });

    for (let i = 0; i < steps.length; i++) {
        if (fullSuiteStopRequested) break;
        const { projectId, tests } = steps[i];
        const project = PROJECTS[projectId];
        broadcast("full-suite-step", { index: i, total: steps.length, project: project.id, label: project.label });
        try {
            const { completion } = await startProjectRun(project, tests, wantHeadless);
            await completion;
        } catch (error) {
            broadcast("log", { stream: "stderr", line: `Automation run stopped: ${error.message}` });
            break;
        }
        if (fullSuiteStopRequested) break;
    }

    fullSuiteRunning = false;
    broadcast("full-suite-complete", { stopped: fullSuiteStopRequested });
}

app.post("/api/run-full-suite", async (req, res) => {
    if (currentRun || runReservation || fullSuiteRunning) {
        return res.status(409).json({ ok: false, message: "A run is already in progress." });
    }
    const wantHeadless = typeof req.body.headless === "boolean" ? req.body.headless : process.env.HEADLESS === "true";
    res.json({ ok: true, message: "Full automation run started.", order: FULL_SUITE_ORDER });
    runProjectSequence(FULL_SUITE_ORDER.map((id) => ({ projectId: id, tests: [] })), wantHeadless);
});

app.get("/api/resume-info", (req, res) => {
    res.json({ ok: true, resumable: !!lastStopPoint, info: lastStopPoint });
});

app.post("/api/resume", async (req, res) => {
    if (!lastStopPoint) {
        return res.status(400).json({ ok: false, message: "Nothing to resume." });
    }
    if (currentRun || runReservation || fullSuiteRunning) {
        return res.status(409).json({ ok: false, message: "A run is already in progress." });
    }
    const wantHeadless = typeof req.body.headless === "boolean" ? req.body.headless : process.env.HEADLESS === "true";
    const point = lastStopPoint;
    lastStopPoint = null; // consumed — a fresh stop point gets recorded if this resume is itself stopped

    if (point.mode === "single") {
        try {
            const { runId, testCount, completion } = await startProjectRun(PROJECTS[point.projectId], point.remainingTests, wantHeadless);
            res.json({ ok: true, runId, testCount, resumed: true });
            completion.catch(() => {});
        } catch (error) {
            const status = /already in progress/.test(error.message) ? 409 : 500;
            res.status(status).json({ ok: false, message: error.message });
        }
        return;
    }

    // full-suite resume: finish the interrupted project's leftover tests
    // first, then continue with whatever projects hadn't started yet.
    res.json({ ok: true, message: "Resuming full automation run.", resumed: true });
    const steps = [
        { projectId: point.projectId, tests: point.remainingTests },
        ...point.remainingOrder.map((id) => ({ projectId: id, tests: [] })),
    ];
    runProjectSequence(steps, wantHeadless);
});

app.post("/api/stop-tests", (req, res) => {
    if (!currentRun) {
        return res.json({ ok: true, message: "Nothing is currently running." });
    }
    // If this stop happens mid-way through a full-suite run, cancel the whole
    // sequence rather than just this step — otherwise the loop in
    // /api/run-full-suite would move on and start the next project anyway.
    fullSuiteStopRequested = fullSuiteRunning;
    const pid = currentRun.proc.pid;
    currentRun.stoppedByUser = true;
    exec(`taskkill /PID ${pid} /T /F`, () => {});
    res.json({ ok: true, message: "Stop signal sent." });
});

async function finalizeRun(projectId, runId, jsonOut, exitCode) {
    const run = currentRun;
    if (!run) return;

    let jsonReport = null;
    try {
        if (fs.existsSync(jsonOut)) {
            jsonReport = JSON.parse(fs.readFileSync(jsonOut, "utf8"));
        }
    } catch (e) {
        // Report may be missing/partial if the run was stopped mid-flight.
    }

    let finalResults = [];

    function walkSpecs(suite, describePath) {
        const nextPath = suite.line > 0 && suite.title ? [...describePath, suite.title] : describePath;
        for (const spec of (suite.specs || [])) {
            const key = testKey(spec.file, spec.line);
            const test = spec.tests && spec.tests[0];
            const result = test && test.results && test.results[0];
            const status = result ? result.status : "skipped";
            const duration = result ? result.duration : 0;

            // Screenshots are only meaningful for a test that didn't cleanly
            // pass — some project configs (e.g. Manager Referral's
            // `screenshot: 'on'`) attach one to every test regardless, so
            // this gate is what actually keeps passed rows screenshot-free,
            // not just hiding it client-side.
            let screenshotUrl = null;
            if (result && status !== "passed" && Array.isArray(result.attachments)) {
                const shot = result.attachments.find((a) => a.name === "screenshot" && a.path);
                if (shot) {
                    const safeName = safeFileName(`${projectId}__${runId}__${spec.title}`) + ".png";
                    try {
                        fs.copyFileSync(shot.path, path.join(screenshotsDir, safeName));
                        screenshotUrl = `/dashboard-screenshots/${safeName}`;
                    } catch (e) {
                        // Source screenshot may not exist if the process was killed abruptly.
                    }
                }
            }

            // One unified "reason" field covering both failure causes and
            // skip reasons — passed tests get null (nothing to explain).
            let reason = null;
            if (status === "failed" || status === "timedOut") {
                if (result && Array.isArray(result.errors) && result.errors[0] && result.errors[0].message) {
                    // Kept full (not just the first line) so the dashboard's friendlyReason()
                    // can parse the matcher's "Expected: .../Received: ..." lines that Playwright
                    // prints after the first line - those carry the only concrete, per-test detail
                    // (e.g. which validation message was/wasn't shown), which a first-line-only
                    // reason discarded and forced into a generic "did not behave as expected".
                    // eslint-disable-next-line no-control-regex
                    reason = result.errors[0].message.replace(/\x1b\[[0-9;]*m/g, "").slice(0, 4000);
                }
                // BrowserFactory.getEnvironmentIssuesSummary() (see utils/BrowserFactory.js)
                // is attached by the spec's own test.afterEach whenever it observed a real
                // HTTP 5xx / failed request against the app during this test - a
                // high-confidence signal that this failure is the environment's fault, not
                // this test's own check. Prepended (not replacing reason) so the dashboard's
                // friendlyReason() can lead with it while "Technical details" still shows the
                // original assertion text underneath.
                if (result && Array.isArray(result.attachments)) {
                    const issueAttachment = result.attachments.find((a) => a.name === "environment-issue");
                    if (issueAttachment) {
                        try {
                            const issueText = issueAttachment.body
                                ? Buffer.from(issueAttachment.body, "base64").toString("utf8")
                                : (issueAttachment.path ? fs.readFileSync(issueAttachment.path, "utf8") : null);
                            if (issueText) reason = `[ENV_ISSUE] ${issueText}\n\n${reason || ""}`.trim();
                        } catch (e) {
                            // Attachment may be missing/unreadable - fall back to the plain reason.
                        }
                    }
                }
            } else if (status === "skipped") {
                const skipAnnotation = test && Array.isArray(test.annotations)
                    ? test.annotations.find((a) => a.type === "skip" || a.type === "fixme")
                    : null;
                reason = (skipAnnotation && skipAnnotation.description) || "Skipped (no reason given)";
            }

            finalResults.push({
                key,
                file: spec.file,
                line: spec.line,
                title: spec.title,
                describe: nextPath.join(" > "),
                status,
                duration,
                screenshot: screenshotUrl,
                reason,
            });
        }
        for (const child of (suite.suites || [])) walkSpecs(child, nextPath);
    }

    if (jsonReport) {
        for (const top of jsonReport.suites || []) walkSpecs(top, []);
    }

    // Strip out any injected prerequisite files (see INTERVIEW_PREREQ_FILES)
    // that actually ran as part of this command but belong to a different
    // project's own checklist/history, not this one's.
    const projectDef = PROJECTS[projectId];
    if (projectDef && projectDef.testFilter) {
        finalResults = finalResults.filter((r) =>
            projectDef.testFilter({ file: r.file, line: r.line, title: r.title, describe: r.describe })
        );
    }

    // Fill in anything requested but missing from the report (e.g. never
    // started because the run was stopped early, or the run was killed
    // before Playwright's JSON reporter could write its output file at all -
    // taskkill /F in /api/stop-tests never gives it the chance to flush, so
    // jsonReport is ALWAYS null for a stopped run, regardless of how many
    // tests had already genuinely passed/failed) using the live-tracked
    // state from stdout parsing instead.
    //
    // Previously this forced status: "stopped" on every single test the
    // instant stoppedByUser was true, discarding the live-tracked pass/fail
    // outcome even for tests that had already finished for real before the
    // stop - confirmed live (2026-09-09): every stopped run in this
    // project's history (14 runs, every project, spanning months) showed
    // exactly 0 passed/0 failed/100% "stopped", including a 63-test
    // phase1phase2 run that had been going for 56 minutes before it was
    // stopped. Only a test that never reached a real pass/fail/timeout
    // (still "queued" or "running" when the process was killed) should be
    // reported as "stopped" - anything that already finished keeps its real
    // live-tracked outcome.
    const seenKeys = new Set(finalResults.map((r) => r.key));
    for (const key of run.order) {
        if (seenKeys.has(key)) continue;
        const meta = run.requested.find((t) => t.key === key) || { file: "", line: 0, title: key, describe: "" };
        const live = run.results.get(key) || { status: "skipped", duration: 0 };
        const liveIsFinal = live.status === "passed" || live.status === "failed" || live.status === "timedOut";
        const status = liveIsFinal ? live.status : (run.stoppedByUser ? "stopped" : live.status);
        let reason = null;
        if (!liveIsFinal && run.stoppedByUser) {
            reason = "Run was stopped before this test started.";
        } else if (liveIsFinal && (status === "failed" || status === "timedOut")) {
            reason = "This test failed before the run was stopped, but its detailed error message wasn't saved because the run ended before Playwright's JSON report could be written.";
        }
        finalResults.push({
            key,
            file: meta.file,
            line: meta.line,
            title: meta.title,
            describe: meta.describe,
            status,
            duration: live.duration,
            screenshot: null,
            reason,
        });
    }

    const totals = finalResults.reduce(
        (acc, r) => {
            acc.total += 1;
            if (r.status === "passed") acc.passed += 1;
            else if (r.status === "failed" || r.status === "timedOut") acc.failed += 1;
            else if (r.status === "stopped") acc.stopped += 1;
            else acc.skipped += 1;
            return acc;
        },
        { total: 0, passed: 0, failed: 0, skipped: 0, stopped: 0 }
    );

    const historyEntry = {
        project: projectId,
        runId,
        startedAt: run.startedAt,
        finishedAt: new Date().toISOString(),
        exitCode,
        stoppedByUser: !!run.stoppedByUser,
        totals,
        results: finalResults,
    };

    fs.writeFileSync(path.join(historyDir, `${projectId}__${runId}.json`), JSON.stringify(historyEntry, null, 2));
    try {
        if (fs.existsSync(jsonOut)) fs.unlinkSync(jsonOut);
    } catch (e) {
        /* best effort cleanup */
    }

    // Remembers exactly what to re-run for the "Resume" button: whichever
    // tests never got a clean pass/fail/skip verdict because the run was
    // stopped mid-way (the in-flight test and everything queued after it).
    // A run that finished on its own (not stopped) clears this, since
    // there's nothing left to resume.
    if (run.stoppedByUser) {
        const remainingTests = finalResults
            .filter((r) => r.status === "stopped" || r.status === "interrupted")
            .map((r) => ({ file: r.file, line: r.line }));
        lastStopPoint = fullSuiteRunning
            ? { mode: "full-suite", projectId, remainingTests, remainingOrder: FULL_SUITE_ORDER.slice(FULL_SUITE_ORDER.indexOf(projectId) + 1) }
            : { mode: "single", projectId, remainingTests };
    } else {
        lastStopPoint = null;
    }
    broadcast("resume-availability", { resumable: !!lastStopPoint });

    currentRun = null;
    broadcast("run-complete", historyEntry);
}

app.listen(3000, () => {
    console.log("Open this in browser: http://localhost:3000");
});
