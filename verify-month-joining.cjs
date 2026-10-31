const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('cheerleader.js', 'utf8') + '\n' + fs.readFileSync('group-challenge.js', 'utf8').replace(/init\(\);\s*$/, '');
const storage = new Map([
  ['october-2026-group-challenge-test-data', JSON.stringify({participants: [{uid: 'returner', name: 'Returning'}], entriesByUid: {}})],
  ['october-2026-group-challenge-test-player', 'returner']
]);
function app(now) {
  const context = vm.createContext({URLSearchParams, URL, Intl, Date, document: {getElementById: () => null},
    window: {location: {search: `?month=2026-11&now=${now}`, hostname: 'localhost', protocol: 'http:'}},
    localStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)},
    fetch: () => assert.fail('Network access during local joining')});
  vm.runInContext(source, context);
  vm.runInContext('render = () => {}; showToast = () => {};', context);
  return code => vm.runInContext(code, context);
}
async function main() {
  const originalOctober = storage.get('october-2026-group-challenge-test-data');
  const early = app('2026-10-31T19:00:00Z');
  await early('fetchAll()');
  assert.equal(early('ownedUid'), 'returner');
  assert.equal(early('participants.length'), 0);
  assert.match(early('testMemberLabel(returningMembers[0])'), /returning, not joined November/);
  assert.equal(early('canLogToday()'), false);
  await early('joinReturningMonth()');
  assert.equal(early('participants[0].startDate'), '2026-11-01');
  assert.equal(early('participants[0].cheerOptIn'), true);
  assert.match(early('testMemberLabel(participants[0])'), /joined November/);
  assert.equal(early('isBeforeChallenge()'), true);
  assert.equal(early('canLogToday()'), false);
  await early('joinReturningMonth()');
  assert.equal(early('participants.length'), 1);
  const day1 = app('2026-11-01T20:00:00Z');
  await day1('fetchAll()');
  assert.equal(day1("getParticipationStartDay('returner')"), 1);
  assert.equal(day1('computeTeamGoalThroughDay(30)'), 6500);
  assert.equal(day1("isRestDay('returner', '2026-11-01')"), false);
  const day2 = app('2026-11-02T20:00:00Z');
  await day2('fetchAll()');
  assert.equal(day2("isRestDay('returner', '2026-11-01')"), true);
  assert.equal(storage.get('october-2026-group-challenge-test-data'), originalOctober);
  storage.delete('november-2026-group-challenge-test-data');
  const late = app('2026-11-10T20:00:00Z');
  await late('fetchAll()');
  assert.equal(late('canLogToday()'), false);
  assert.equal(late('canChooseRestToday()'), false);
  late("participants.push({uid:'other-id', name:' RETURNING '});");
  await late('joinReturningMonth()');
  assert.equal(late('participants.length'), 1);
  assert.equal(late("participants[0].uid"), 'other-id');
  late('participants = [];');
  late("document.getElementById = id => id === 'returningCheerOptIn' ? {checked:false} : null;");
  await late('joinReturningMonth()');
  assert.equal(late('participants[0].cheerOptIn'), false);
  assert.equal(late("getParticipationStartDay('returner')"), 10);
  assert.equal(late('computeTeamGoalThroughDay(30)'), 4750);
  assert.equal(late("getRestWeek('returner', 10).eligible"), false);
  assert.equal(late('canLogToday()'), true);
  late("participants.push({uid:'new', name:'New'}); entriesByUid.new = {};");
  assert.equal(late("getParticipationStartDay('new')"), null);
  late("entriesByUid.new['2026-11-10'] = {selected:['pushups'], values:{pushups:1}};");
  assert.equal(late("getParticipationStartDay('new')"), 10);
  late("entriesByUid.new['2026-11-10'].values.pushups = 0;");
  assert.equal(late("getParticipationStartDay('new')"), null);
  console.log('PASS: opt-in required, early/month-start/late starts, auto rest after day ends, goals, new-member first-points rule, persistence, duplicate prevention, and October preserved.');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
