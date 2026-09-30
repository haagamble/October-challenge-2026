const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = __dirname;
const source = fs.readFileSync(path.join(root, 'group-challenge.js'), 'utf8').replace(/init\(\);\s*$/, '') + '\n' + fs.readFileSync(path.join(__dirname, 'cheerleader.js'), 'utf8');
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
  if(computeTeamGoalThroughDay(31)!==10000) throw Error('First-positive goal');
  if(computeTeamGoalThroughDay(10)!==500) throw Error('Pace');
  entriesByUid.a['2026-10-09'].values.walking=0;
  if(computeTeamGoalThroughDay(31)!==4750) throw Error('Correction');
  getChallengeDateParts = () => ({year:2026,month:9,day:30});
  if(computeTeamGoalThroughDay(31)!==0 || formatDateKey(getCurrentDate())!=='2026-10-01') throw Error('Before start');
`,context);
vm.runInContext(`
  const merged = sanitizeEntries({'2026-10-02':{selected:['running','walking','squats'],values:{running:20,walking:35,squats:10}}});
  if (merged['2026-10-02'].selected.join(',') !== 'walking,squats' || merged['2026-10-02'].values.walking !== 55) throw Error('Combined minutes');
  const runningOnly = sanitizeEntries({'2026-10-03':{selected:['running'],values:{running:15,walking:90}}});
  if (runningOnly['2026-10-03'].values.walking !== 15) throw Error('Unselected values must not count');
  if (JSON.stringify(sanitizeEntries(merged)) !== JSON.stringify(merged)) throw Error('Repeated normalization');
  entriesByUid = {a:merged};
  getChallengeDateParts = () => ({year:2026,month:10,day:2});
  if (computePlayerTotalsForDate('a','2026-10-02') !== 210) throw Error('Shared doubled cap');
  for (const [id, rate, capMinutes, doubleDate] of [['walking',2,50,'2026-10-02'],['dancing',4,25,'2026-10-07']]) {
    const activity=getActivity(id);
    for(const minutes of [0,1,3,7,capMinutes-1,capMinutes,capMinutes+10]) {
      if(computeActivityBasePoints(activity,minutes)!==Math.min(minutes*rate,100)) throw Error('Per-minute scoring '+id);
      entriesByUid={a:{[doubleDate]:{selected:[id],values:{[id]:minutes}}}};
      if(computeRawPlayerPoints('a',doubleDate)!==Math.min(minutes*rate,100)*2) throw Error('Per-minute double points '+id);
    }
  }
  const strength=getActivity('strength');
  if (computeActivityBasePoints(strength,35)!==35 || computeActivityBasePoints(strength,150)!==100) throw Error('Strength scoring');
  entriesByUid={a:sanitizeEntries({'2026-10-01':{selected:['strength'],values:{strength:125}}})};
  getChallengeDateParts = () => ({year:2026,month:10,day:1});
  if (computePlayerTotalsForDate('a','2026-10-01')!==200) throw Error('Strength double cap');
  if (ACTIVITY_DEFS.length !== 11 || ACTIVITY_DEFS.some(a=>a.id==='running')) throw Error('Choices');
  for (const id of DOUBLE_ACTIVITY_SCHEDULE) if(!getActivity(id)) throw Error('Unknown double activity');
  if (getActivity('squats').name!=='Squats/Lunges') throw Error('Squat label');
`,context);
const rules=JSON.parse(fs.readFileSync(path.join(root,'database.rules.json'))).rules;
assert.deepEqual(Object.keys(rules).sort(), ['.read','.write','groupChallengeOctober2026','settingsOctober2026','cheerleaderScheduleOctober2026','cheerleaderClaimsOctober2026'].sort());
assert.equal(rules['.read'], false);
assert.equal(rules['.write'], false);
assert.match(rules.groupChallengeOctober2026.$uid['.write'],/settingsOctober2026\/joinOpen/);
assert.ok(rules.groupChallengeOctober2026.$uid.entries.$date['.validate'].startsWith('$date.matches(/^2026-10-(0[1-9]|[12][0-9]|3[01])$/)'));
assert.ok(rules.groupChallengeOctober2026.$uid.entries.$date.rest);
assert.ok(rules.groupChallengeOctober2026.$uid.entries.$date.selected.$index['.validate'].includes('|strength|'));
assert.ok(rules.groupChallengeOctober2026.$uid.entries.$date.values.$activity['.validate'].includes('|strength|'));
const handlers={}; const deleted=[]; let pending;
vm.runInNewContext(fs.readFileSync(path.join(root,'service-worker.js'),'utf8'),{
 self:{addEventListener:(name,fn)=>handlers[name]=fn,clients:{claim:()=>{}},registration:{scope:'https://example.test/Oct-group-challenge-2026/'}},
 caches:{keys:async()=>['group-challenge-v48','plank-v1','october-2026-group-challenge-v0','october-2026-group-challenge-v9'],delete:async key=>deleted.push(key)},URL
});
handlers.activate({waitUntil:p=>pending=p});
pending.then(()=>{
 assert.deepEqual(deleted,['october-2026-group-challenge-v0']);
 for(const url of ['https://example.test/group-challenge-2026/index.html','https://database.test/groupChallenge.json']) {
  handlers.fetch({request:{method:'GET',url},respondWith:()=>assert.fail('Intercepted unrelated request')});
 }
 console.log('PASS: October dates, 31-day schedule, goal/pace/corrections, October-only rules, and cache isolation.');
}).catch(error=>{console.error(error);process.exitCode=1;});
