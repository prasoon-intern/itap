// config.js — equivalent to config.properties
const { futureDateDDMMYYYY } = require('./utils/DateHelpers');

const config = {
  url:'https://fcadmin100-dev.apps.ap-3a.mendixcloud.com/p/candidatelogin',
  CANDIDATE_URL: 'https://fcadmin100-dev.apps.ap-3a.mendixcloud.com/p/candidatelogin',
  FC_URL: 'https://fcadmin100-dev.apps.ap-3a.mendixcloud.com/login.html',
  // Manager Referral form + report — a public page, no login required
  // (confirmed live: reached directly, no auth redirect).
  MANAGER_REFERRAL_URL: 'https://fcadmin100-dev.apps.ap-3a.mendixcloud.com/p/ManagerReferral',
  browser: 'chromium',
  
  // FC Admin credentials
  // Previously 'Kanika' - confirmed live that account's role has no
  // Appointment access at all (sidebar excludes it entirely), so
  // Interview.spec.js could never get past the first navigation step.
  // Switched to an account confirmed live to have full Appointment/
  // Interview access.
  username: 'akshay.gupta',
  password: 'Mankind@12345',
  
  // Interview scheduling
  // Was a fixed '20/04/2026' - silently became a PAST date once real time
  // caught up to it, which broke Schedule Interview with zero visible
  // failure (confirmed live: the flow silently stalled on "Please Select
  // Future Date" while every step still reported "passed"). Computed
  // relative to today so it can never go stale again.
  interviewDate: futureDateDDMMYYYY(6),  // Format: DD/MM/YYYY
  // Interviewer to select every time the automation schedules an interview.
  // Per explicit user instruction: always "Aakriti" (real dropdown entry is
  // "Aakriti ." - confirmed live, typing "Aakriti" alone matches only her).
  interviewerName: 'Aakriti',
  
  // Candidate details
  ManagerRefID: '10001556',
  AadharNum: '100000000018',
  // Candidate signup explicitly rejects official "@mankindpharma.com" addresses
  // ("Official Mankind email IDs are not allowed. Please enter a personal email
  // address.") — confirmed against the live form. Use a personal-looking address
  // for the signup form itself; EmailId below stays a real, monitored inbox
  // because it's used for FC Admin interviewer/candidate email notifications,
  // which need to actually be checkable.
  PersonalEmailId: 'discovery.candidate18@gmail.com',
  // Recipient for every FC Admin Interview email step (interviewer/candidate
  // notifications, status-update internal emails). Per explicit direction:
  // always yuvraj.intern@mankindpharma.com for this test suite.
  EmailId: 'yuvraj.intern@mankindpharma.com',
  // Fixed Aadhaar reserved for the "duplicate signup" negative test
  // (tests/Candidate/SignUpSignIn.spec.js, "Candidate Signup - Negative & Edge Cases").
  // Never used by the real signup/login flow, so it's safe to sign up with
  // repeatedly on purpose.
  DuplicateTestAadhar: '999999000001',
  NewPassword: 'Mankind@1234',
  ConfirmPassword: 'Mankind@1234',
  FirstName: 'Discovery',
  MiddleName: 'User',
  LastName: '18',
  division: 'Mankind',
  Role: 'MR',
  HQPreference: 'SHYAM VIHAR (DELHI)',

  // HR-role account for the Document Verification portal - a SEPARATE login
  // from the FC Admin (akshay.gupta) account above, confirmed to have its
  // own distinct sidebar (Document Verification, Vacant Position Master,
  // HR All Candidate Details) not present for akshay.gupta.
  hrUsername: 'nimisha',
  hrPassword: 'Mankind@12345',
  // Field Coordinator to select every time the automation verifies
  // documents. Per explicit user instruction: always "Akshay Gupta", never
  // another name from the dropdown (which also lists real staff like
  // Krishna Kr. Srivastava, Sandeep Kumar, etc.).
  fieldCoordinatorName: 'Akshay Gupta',
};

module.exports = config;
