const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
// Match the browser's script order: cheerleader state first, app settings second.
const source = fs.readFileSync('cheerleader.js', 'utf8') + '\n' + fs.readFileSync('group-challenge.js', 'utf8').replace(/init\(\);\s*$/, '');
function preview(search, hostname = 'localhost') {
  const context = vm.createContext({window: {location: {search, hostname, protocol: 'http:'}}, URLSearchParams, Intl, Date,
    localStorage: {getItem: () => null}, fetch: () => assert.fail('Preview attempted network access')});
  vm.runInContext(source, context);
  return code => vm.runInContext(code, context);
}
async function main() {
  const october = preview('?now=2026-11-01T06:59:59Z');
  assert.equal(october('MONTH_KEY'), '2026-10');
  assert.equal(october('isInChallengeMonth()'), true);
  const november = preview('?now=2026-11-01T07:00:00Z');
  assert.equal(november('MONTH_KEY'), '2026-11');
  assert.equal(november('DAYS_IN_MONTH'), 30);
  assert.equal(november('DOUBLE_ACTIVITY_SCHEDULE.length'), 30);
  assert.equal(november("isChallengeDateKey('2026-11-31')"), false);
  assert.equal(november("isChallengeDateKey('2026-10-31')"), false);
  assert.equal(november('CHALLENGE_DATA_PATH'), 'groupChallengeNovember2026');
  assert.equal(november('CHEER_SCHEDULE_PATH'), 'cheerleaderScheduleNovember2026');
  assert.notEqual(october('TEST_STORAGE_KEY'), november('TEST_STORAGE_KEY'));
  await assert.rejects(november("firebaseRequest('anything')"), /disabled/);
  const history = preview('?month=2026-10&now=2026-11-02T08:00:00Z');
  assert.equal(history('isInChallengeMonth()'), false);
  assert.equal(history('getCurrentDate().getUTCDate()'), 31);
  assert.equal(history("ownedUid = 'a'; canLogToday()"), false);
  await assert.rejects(history('saveOwnedRecord()'), /read-only/);
  const dst = preview('?now=2026-11-02T07:59:59Z');
  assert.equal(dst('actualTodayKey()'), '2026-11-01');
  assert.equal(preview('?now=2026-11-02T08:00:00Z')('actualTodayKey()'), '2026-11-02');
  const live = preview('?month=2026-10&now=2030-01-01T00:00:00Z', 'example.test');
  assert.equal(live('previewNow'), null);
  assert.equal(live('TEST_MODE'), false);
  console.log('PASS: Pacific rollover/DST, month paths and storage isolation, November dates, read-only October, preview network guard, live clock protection.');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
