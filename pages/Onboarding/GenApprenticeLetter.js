// Gen Apprentice Letter shares its page object 1:1 with Gen Offer Letter and
// Gen Appointment Letter - all three open the same 3-tab Generate Letter page
// pattern in Mendix, and every field in ITAP_GenerateOfferLetter is located
// by its visible label text rather than a page-specific widget id, so the
// exact same class works unchanged against all three pages (see the
// class-level comment in pages/Onboarding/GenOfferLetter.js).
//
// Created ahead of need (2026-09-02): tests/Onboarding/GenApprenticeLetter.spec.js
// doesn't use this yet - its only 2 real tests (ONB-PL-01, ONB-PL-02) are
// negative gates that block before the actual letter page ever opens. This
// file exists now so it's already in place once ONB-PL-03 (the skipped
// positive path, pending an MCPPL-division ManagerRefID) is unblocked and
// needs real field access - at that point, import ITAP_GenerateOfferLetter
// from here, the same way GenAppointmentLetter.spec.js already does.
const { ITAP_GenerateOfferLetter } = require('./GenOfferLetter');

module.exports = { ITAP_GenerateOfferLetter };
