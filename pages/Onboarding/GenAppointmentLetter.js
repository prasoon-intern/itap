// Gen Appointment Letter shares its page object 1:1 with Gen Offer Letter -
// both open the same 3-tab Generate Letter page pattern in Mendix, and every
// field in ITAP_GenerateOfferLetter is located by its visible label text
// rather than a page-specific widget id, so the exact same class works
// unchanged against either page (see the class-level comment in
// pages/Onboarding/GenOfferLetter.js). Re-exported here under this file's
// name so tests/Onboarding/GenAppointmentLetter.spec.js has a matching page
// file to import from, with zero duplicated code.
const { ITAP_GenerateOfferLetter } = require('./GenOfferLetter');

module.exports = { ITAP_GenerateOfferLetter };
