const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('cheerleader.js', 'utf8') + '\n' + fs.readFileSync('group-challenge.js', 'utf8').replace(/init\(\);\s*$/, '');
const dataKey = 'november-2026-group-challenge-test-data';
const scheduleKey = `${dataKey}-cheer-schedule`;
function setup(members) {
  const storage = new Map([[dataKey, JSON.stringify({participants: members})]]);
  let writes = 0, queue = Promise.resolve();
  function visit(now) {
    const nodes = new Map();
    const node = () => ({textContent: '', children: [], classList:{toggle(){}}, replaceChildren(){this.children=[];}, appendChild(child){this.children.push(child);}});
    const document = {getElementById(id){if (!nodes.has(id)) nodes.set(id,node()); return nodes.get(id);}, createElement:node};
    const context = vm.createContext({Intl, Date, URLSearchParams, URL,
      document,
      window: {location: {hostname:'localhost', protocol:'http:', search:`?month=2026-11&now=${now}`},
        navigator: {locks: {request: (_key, fn) => {const result = queue.then(fn); queue = result.catch(() => {}); return result;}}}},
      localStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, value) => {storage.set(key, value); if (key === scheduleKey) writes++;}},
      fetch: () => assert.fail('Local scheduling accessed Firebase')});
    vm.runInContext(source, context);
    return code => vm.runInContext(code, context);
  }
  return {storage, visit, writes: () => writes};
}
async function main() {
  const members = [
    {uid:'early', name:'Early', joinedAt:'2026-10-31T20:00:00Z'},
    {uid:'first', name:'First', joinedAt:'2026-11-01T20:00:00Z'},
    {uid:'last', name:'Last', joinedAt:'2026-11-02T07:59:59.999Z'},
    {uid:'late', name:'Late', joinedAt:'2026-11-02T08:00:00Z'},
    {uid:'opted-out', name:'Opted Out', cheerOptIn:false, joinedAt:'2026-11-01T20:00:00Z'},
    {uid:'unknown', name:'Unknown'}
  ];
  const test = setup(members);
  await test.visit('2026-11-02T07:59:59Z')('fetchAll()');
  assert.equal(test.writes(), 0, 'Pacific November 1 has not ended');
  const first = test.visit('2026-11-02T08:00:00Z');
  const second = test.visit('2026-11-02T08:00:00Z');
  await Promise.all([first('fetchAll()'), second('fetchAll()')]);
  assert.equal(test.writes(), 1, 'Only one schedule is persisted across simultaneous visitors');
  const saved = test.storage.get(scheduleKey);
  const result = JSON.parse(saved);
  assert.deepEqual(result.eligibleUids, ['early','first','last']);
  assert.equal(Object.keys(result.schedule).length, 29);
  assert.equal(result.schedule['2026-11-01'], undefined);
  assert.ok(result.schedule['2026-11-30']);
  const counts = result.eligibleUids.map(uid => Object.values(result.schedule).filter(item => item.uid === uid).length);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
  assert.equal(JSON.stringify(first('cheerSchedule')), JSON.stringify(second('cheerSchedule')));
  first("ownedUid = 'early'; renderAutomaticCheerSchedule();");
  assert.equal(first("document.getElementById('automaticCheerList').children.length"), counts[0]);
  assert.equal(first("document.getElementById('automaticCheerList').children.every(row => /^November \\d+$/.test(row.textContent))"), true);
  first("ownedUid = 'opted-out'; renderAutomaticCheerSchedule();");
  assert.equal(first("document.getElementById('automaticCheerList').children.length"), 0);
  assert.match(first("document.getElementById('automaticCheerStatus').textContent"), /opted out/);
  first("ownedUid = null; renderAutomaticCheerSchedule();");
  assert.equal(first("document.getElementById('automaticCheerList').children.length"), 0);
  test.storage.set(dataKey, JSON.stringify({participants: [...members, {uid:'new',name:'New',joinedAt:'2026-11-03T20:00:00Z'}]}));
  await test.visit('2026-11-03T20:00:00Z')('fetchAll()');
  assert.equal(test.storage.get(scheduleKey), saved, 'Later joins/visits cannot regenerate schedule');
  const empty = setup([]);
  await empty.visit('2026-11-03T20:00:00Z')('fetchAll()');
  assert.deepEqual(JSON.parse(empty.storage.get(scheduleKey)).schedule, {});
  assert.equal(empty.writes(), 1, 'Empty roster also freezes once');
  const delayed = setup(members);
  await delayed.visit('2026-11-05T20:00:00Z')('fetchAll()');
  assert.deepEqual(JSON.parse(delayed.storage.get(scheduleKey)).eligibleUids, ['early','first','last']);
  console.log('PASS: Pacific/DST cutoff, early and point-free joiners, late exclusions, 29 balanced assignments, simultaneous visitors, fixed persistence, empty roster, and delayed first visit.');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
