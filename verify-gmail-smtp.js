// ONE-OFF VERIFICATION SCRIPT - not part of the email notification feature
// itself. Tests the fallback path: personal Gmail sends -> company email
// receives (agreed on since company-email-as-sender is blocked by org
// policy - no App Passwords option exists for that account).
//
// Setup: make sure .env (same folder) has PERSONAL_GMAIL_ADDRESS,
// PERSONAL_GMAIL_APP_PASSWORD (the 16-char code from
// https://myaccount.google.com/apppasswords, NOT your real Gmail password),
// and COMPANY_EMAIL_ADDRESS (just used as the recipient here, no password
// needed for that side - receiving needs no auth).
//
// Run:  node verify-gmail-smtp.js
require('dotenv').config();
const nodemailer = require('nodemailer');

const { PERSONAL_GMAIL_ADDRESS, PERSONAL_GMAIL_APP_PASSWORD, COMPANY_EMAIL_ADDRESS } = process.env;

if (!PERSONAL_GMAIL_ADDRESS || !PERSONAL_GMAIL_APP_PASSWORD) {
  console.log('Missing PERSONAL_GMAIL_ADDRESS / PERSONAL_GMAIL_APP_PASSWORD - fill in .env first, then SAVE the file.');
  process.exit(1);
}
if (!COMPANY_EMAIL_ADDRESS) {
  console.log('Missing COMPANY_EMAIL_ADDRESS - used here only as the test recipient. Fill it in .env and save.');
  process.exit(1);
}

(async () => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: PERSONAL_GMAIL_ADDRESS, pass: PERSONAL_GMAIL_APP_PASSWORD },
  });

  console.log(`Attempting to send a test email as ${PERSONAL_GMAIL_ADDRESS} (Gmail) to ${COMPANY_EMAIL_ADDRESS}...`);
  try {
    await transporter.verify();
    console.log('SMTP AUTH SUCCEEDED - Gmail login works.');

    const info = await transporter.sendMail({
      from: PERSONAL_GMAIL_ADDRESS,
      to: COMPANY_EMAIL_ADDRESS,
      subject: 'ITAP dashboard - Gmail SMTP verification test',
      text: 'If you received this in your company inbox, the Gmail-sends/company-receives fallback works.',
    });
    console.log('TEST EMAIL SENT SUCCESSFULLY. Message ID:', info.messageId);
    console.log('\nRESULT: this route works. Check your COMPANY inbox to confirm delivery (and check spam/junk too).');
  } catch (err) {
    console.log('\nRESULT: FAILED.');
    console.log('Error:', err.message);
    if (/Username and Password not accepted|Invalid login/i.test(err.message || '')) {
      console.log('\nMost likely cause: the app password is wrong, or your real Gmail password was used by');
      console.log('mistake instead of the 16-character app password. Double-check PERSONAL_GMAIL_APP_PASSWORD');
      console.log('in .env matches exactly what Google showed you (spaces in the code are fine to keep or remove).');
    }
  }
})();
