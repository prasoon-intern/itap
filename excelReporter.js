const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const workbookPath = path.join(__dirname, 'TestResults.xlsx');
const flowConfigPath = path.join(__dirname, 'flowConfig.json');
const reportsDir = path.join(__dirname, 'run-reports');

const pendingRows = [];

function loadFlowConfig() {
  try {
    return JSON.parse(fs.readFileSync(flowConfigPath, 'utf8'));
  } catch (error) {
    return {};
  }
}

// Generated once per process and cached - with playwright.config.js's
// workers: 1, every spec file in one CLI/dashboard run shares this single
// worker process, so this gives one shared sheet name per run without
// needing anything external to coordinate it.
let cachedSheetName = null;

function getSheetName() {
  if (!cachedSheetName) {
    // Previously read flowConfig.json's reportSheetName - that field was
    // only ever refreshed by the old /run endpoint (index.html's scenario
    // picker), removed 2026-09-02 as dead code. Left in place, it would have
    // stayed frozen forever at whatever scenario last ran through /run
    // (confirmed live: frozen since 2026-08-17), silently overwriting the
    // same "R20260817101224-S005" tab on every run instead of each run
    // getting its own. Always generating a fresh timestamp-based name here
    // fixes that for every future run, dashboard-triggered or CLI.
    cachedSheetName = sanitizeSheetName(`Run-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}`);
  }
  return cachedSheetName;
}

function sanitizeSheetName(name) {
  return name.replace(/[:\\/?*\[\]]/g, '-').slice(0, 31);
}

function addResult(testInfo) {
  pendingRows.push({
    name: testInfo.title,
    status: testInfo.status,
    duration: testInfo.duration,
  });
}

function buildSummaryRows(flowConfig) {
  const signupAadhar = flowConfig.aadharNum || config.AadharNum;

  return [
    ['Run Info', ''],
    ['Run ID', flowConfig.runId || ''],
    ['Report Tab', flowConfig.reportSheetName || ''],
    ['', ''],
    ['Selected Options', ''],
    ['Entry', flowConfig.entry || ''],
    ['Address', flowConfig.address || ''],
    ['Vehicle Number', flowConfig.vehicleNumber || ''],
    ['Interview Date', flowConfig.interviewDate || ''],
    ['Additional Qualification', flowConfig.additionalQualification || ''],
    ['Experience', flowConfig.experience || ''],
    ['Rounds', flowConfig.rounds || ''],
    ['Result', flowConfig.result || ''],
    ['Training', flowConfig.training || ''],
    ['Complete', flowConfig.complete || ''],
    ['HR', flowConfig.hr || ''],
    ['', ''],
    ['Signup Details', ''],
    ['Aadhaar Number', signupAadhar],
    ['Email ID', config.PersonalEmailId || config.EmailId || ''],
    ['First Name', config.FirstName || ''],
    ['Middle Name', config.MiddleName || ''],
    ['Last Name', config.LastName || ''],
    ['Division', config.division || ''],
    ['Manager Ref ID', config.ManagerRefID || ''],
    ['Role', config.Role || ''],
    ['HQ Preference', config.HQPreference || ''],
    ['New Password', config.NewPassword || ''],
    ['Confirm Password', config.ConfirmPassword || ''],
  ];
}

function buildScenarioReport(flowConfig) {
  const counts = pendingRows.reduce((acc, row) => {
    const status = String(row.status || '').toLowerCase();
    if (status.includes('pass')) acc.passed += 1;
    else if (status.includes('fail')) acc.failed += 1;
    else acc.skipped += 1;
    return acc;
  }, { passed: 0, failed: 0, skipped: 0 });

  return {
    runId: flowConfig.runId || '',
    reportSheetName: flowConfig.reportSheetName || '',
    createdAt: new Date().toISOString(),
    selectedOptions: {
      entry: flowConfig.entry || '',
      address: flowConfig.address || '',
      vehicleNumber: flowConfig.vehicleNumber || '',
      interviewDate: flowConfig.interviewDate || '',
      additionalQualification: flowConfig.additionalQualification || '',
      experience: flowConfig.experience || '',
      rounds: flowConfig.rounds || '',
      result: flowConfig.result || '',
      training: flowConfig.training || '',
      complete: flowConfig.complete || '',
      hr: flowConfig.hr || '',
    },
    signupDetails: {
      aadharNum: flowConfig.aadharNum || config.AadharNum,
      emailId: config.PersonalEmailId || config.EmailId || '',
      firstName: config.FirstName || '',
      middleName: config.MiddleName || '',
      lastName: config.LastName || '',
      division: config.division || '',
      managerRefID: config.ManagerRefID || '',
      role: config.Role || '',
      hqPreference: config.HQPreference || '',
      newPassword: config.NewPassword || '',
      confirmPassword: config.ConfirmPassword || '',
    },
    summary: {
      total: pendingRows.length,
      passed: counts.passed,
      failed: counts.failed,
      skipped: counts.skipped,
    },
    tests: pendingRows,
  };
}

async function saveFile() {
  console.log('🔥 Saving Excel file...');

  const workbook = new ExcelJS.Workbook();
  const flowConfig = loadFlowConfig();

  if (fs.existsSync(workbookPath)) {
    await workbook.xlsx.readFile(workbookPath);
  }

  const sheetName = getSheetName();
  if (workbook.getWorksheet(sheetName)) {
    workbook.removeWorksheet(workbook.getWorksheet(sheetName).id);
  }

  const sheet = workbook.addWorksheet(sheetName);
  const scenarioReport = buildScenarioReport(flowConfig);

  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportFileName = `${sheetName || 'run'}.json`;
  fs.writeFileSync(path.join(reportsDir, reportFileName), JSON.stringify(scenarioReport, null, 2));

  const summaryRows = buildSummaryRows(flowConfig);
  let currentRow = 1;

  for (const [label, value] of summaryRows) {
    sheet.getCell(currentRow, 1).value = label;
    sheet.getCell(currentRow, 2).value = value;
    if (!label) {
      currentRow += 1;
      continue;
    }
    if (['Run Info', 'Selected Options', 'Signup Details'].includes(label)) {
      sheet.getRow(currentRow).font = { bold: true };
    }
    currentRow += 1;
  }

  currentRow += 1;
  sheet.getCell(currentRow, 1).value = 'Test Name';
  sheet.getCell(currentRow, 2).value = 'Status';
  sheet.getCell(currentRow, 3).value = 'Duration';
  sheet.getRow(currentRow).font = { bold: true };
  sheet.getRow(currentRow).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8EEF9' },
  };

  const headerRow = currentRow;
  currentRow += 1;

  for (const row of pendingRows) {
    sheet.getCell(currentRow, 1).value = row.name;
    sheet.getCell(currentRow, 2).value = row.status;
    sheet.getCell(currentRow, 3).value = row.duration;
    currentRow += 1;
  }

  sheet.columns = [
    { key: 'name', width: 45 },
    { key: 'status', width: 15 },
    { key: 'duration', width: 15 },
  ];
  sheet.getColumn(1).width = 45;
  sheet.getColumn(2).width = 18;
  sheet.getColumn(3).width = 14;
  sheet.getRow(headerRow).alignment = { horizontal: 'center' };

  try {
    await workbook.xlsx.writeFile(workbookPath);
    console.log(`✅ Excel saved to ${workbookPath} on tab ${sheetName}!`);
  } catch (error) {
    if (error.code !== 'EBUSY') {
      throw error;
    }

    const fallbackPath = path.join(__dirname, `TestResults-${flowConfig.runId || Date.now()}.xlsx`);
    await workbook.xlsx.writeFile(fallbackPath);
    console.log(`⚠️ Workbook locked, saved partial report to ${fallbackPath} on tab ${sheetName}!`);
  }
}

function clearResults() {
  pendingRows.length = 0;
  console.log('🗑️ Cleared pending test results');
}

module.exports = { addResult, saveFile, clearResults };
