const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = __dirname;
const source = fs.readFileSync(path.join(root, 'group-challenge.js'), 'utf8').replace(/init\(\);\s*$/, '');
const context = vm.createContext({window:{location:{search:'?test=1', href:'https://example.test/Oct-group-challenge-2026/', hostname:'example.test'}},localStorage:{getItem:()=>null}, URLSearchParams, URL, Intl, Date});
vm.runInContext(source, context);
vm.runInContext(`
  if (CHALLENGE_YEAR !== 2026 || CHALLENGE_MONTH !== 9 || DAYS_IN_MONTH !== 31) throw Error('Month');
  if (DOUBLE_ACTIVITY_SCHEDULE.length !== 31 || DOUBLE_ACTIVITY_SCHEDULE.includes('other')) throw Error('Schedule');
  if (getDoubleActivityId(new Date('2026-10-31T12:00:00Z')) !== 'walking') throw Error('Day 31');
  for (let day=1; day<=31; day++) if (!isChallengeDateKey('2026-10-'+String(day).padStart(2,'0'))) throw Error('Valid date');
  for (const date of ['2026-09-30','2026-11-01','2025-10-01','2026-10-00','2026-10-32']) if(isChallengeDateKey(date)) throw Error('Invalid date');
  getChallengeDateParts = () => ({year:2026,month:11,day:1});
  if (formatDateKey(getCurrentDate()) !== '2026-10-31') throw Error('End clamp');
  participants = [{uid:'a'},{uid:'b'},{uid:'empty'}];
  entriesByUid = {a:{'2026-10-01':{selected:['walking'],values:{walking:0}},'2026-10-09':{selected:['walking'],values:{walking:5}}}, b:{'2026-10-11':{selected:['walking'],values:{walking:5}}}};
  if(computeTeamGoalThroughDay(31)!==11000) throw Error('First-positive goal');
  if(computeTeamGoalThroughDay(10)!==500) throw Error('Pace');
  entriesByUid.a['2026-10-09'].values.walking=0;
  if(computeTeamGoalThroughDay(31)!==5250) throw Error('Correction');
  getChallengeDateParts = () => ({year:2026,month:9,day:30});
  if(computeTeamGoalThroughDay(31)!==0 || formatDateKey(getCurrentDate())!=='2026-10-01') throw Error('Before start');
`,context);
const rules=JSON.parse(fs.readFileSync(path.join(root,'database.rules.json'))).rules;
const september=JSON.parse(fs.readFileSync(path.join(root,'../group-challenge-2026/database.rules.json'))).rules;
for(const key of Object.keys(september)) assert.deepEqual(rules[key],september[key]);
assert.match(rules.groupChallengeOctober2026.$uid['.write'],/settingsOctober2026\/joinOpen/);
assert.equal(rules.groupChallengeOctober2026.$uid.entries.$date['.validate'], '$date.matches(/^2026-10-(0[1-9]|[12][0-9]|3[01])$/)');
const handlers={}; const deleted=[]; let pending;
vm.runInNewContext(fs.readFileSync(path.join(root,'service-worker.js'),'utf8'),{
 self:{addEventListener:(name,fn)=>handlers[name]=fn,clients:{claim:()=>{}},registration:{scope:'https://example.test/Oct-group-challenge-2026/'}},
 caches:{keys:async()=>['group-challenge-v48','plank-v1','october-2026-group-challenge-v0','october-2026-group-challenge-v1'],delete:async key=>deleted.push(key)},URL
});
handlers.activate({waitUntil:p=>pending=p});
pending.then(()=>{
 assert.deepEqual(deleted,['october-2026-group-challenge-v0']);
 for(const url of ['https://example.test/group-challenge-2026/index.html','https://database.test/groupChallenge.json']) {
  handlers.fetch({request:{method:'GET',url},respondWith:()=>assert.fail('Intercepted unrelated request')});
 }
 console.log('PASS: October dates, 31-day schedule, goal/pace/corrections, preserved September rules, and cache isolation.');
}).catch(error=>{console.error(error);process.exitCode=1;});
