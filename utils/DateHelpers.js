// utils/DateHelpers.js
// A hardcoded interview date ("20/04/2026") silently became a PAST date once
// real time caught up to it, and the Schedule Interview flow has no
// assertions checking for the "Please Select Future Date" error - so it kept
// reporting every scheduling step as "passed" while silently never actually
// allocating a slot. This computes a date relative to "now" so it can never
// go stale again.
function futureDateDDMMYYYY(monthsAhead = 6) {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Computes a DOB exactly N years before today (same month/day), so an
// "exactly N years old today" boundary test (e.g. the Personal Details form's
// live-confirmed "minimum permissible age is 18 years" validation) never goes
// stale the way a hardcoded DOB literal would.
function dobYearsAgoDDMMYYYY(yearsAgo) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - yearsAgo);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

module.exports = { futureDateDDMMYYYY, dobYearsAgoDDMMYYYY };
