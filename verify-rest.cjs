const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'group-challenge.js'), 'utf8').replace(/init\(\);\s*$/, '');
const nodes = new Map();
function element() {
  return { children: [], classList: {add(){},remove(){},toggle(){}}, style: {},
    appendChild(child) { this.children.push(child); }, append(...items) { this.children.push(...items); },
    replaceChildren() { this.children=[]; }, setAttribute(key,value) { this[key]=value; }, addEventListener(){} };
}
const document = {createElement: element, getElementById(id) { if(!nodes.has(id)) nodes.set(id,element()); return nodes.get(id); }};
const storage = new Map();
const context = vm.createContext({assert, document, window:{location:{search:'?test=1',href:'https://example.test/October/',hostname:'example.test'}},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},URLSearchParams,URL,Intl,Date});
vm.runInContext(source,context);
const run = code => vm.runInContext(code,context);
run(`
  const realDateParts = getChallengeDateParts;
  assert.equal(realDateParts(new Date('2026-10-02T06:59:59Z')).day, 1);
  assert.equal(realDateParts(new Date('2026-10-02T07:00:00Z')).day, 2);
  let testDay = 1;
  getChallengeDateParts = () => ({year:2026,month:10,day:testDay});
  const points = () => ({selected:['walking'],values:{walking:5}});
  function reset(day=1) {
    testDay=day; participants=[{uid:'a',name:'A'}]; ownedUid='a';
    entriesByUid={a:{}}; pendingOwnedSaves=0;
  }
  reset();
  assert.equal(getParticipationStartDay('a'),null);
  assert.equal(computeTeamGoalThroughDay(31),0);
  assert.equal(canChooseRestToday(),true);
  entriesByUid.a[challengeKey(1)]={rest:true};
  assert.equal(getParticipationStartDay('a'),1);
  assert.equal(computeTeamGoalThroughDay(31),6750);
  assert.equal(computeTeamGoalThroughDay(1),0);
  assert.equal(isRestDay('a',challengeKey(1)),true);
  assert.equal(canLogToday(),false);
  assert.equal(computePlayerTotalsForDate('a',challengeKey(1)),0);
  testDay=2;
  assert.equal(canLogToday(),true);
  assert.equal(canChooseRestToday(),false);
  assert.equal(computeTeamGoalThroughDay(2),250);

  reset(3); entriesByUid.a[challengeKey(3)]=points();
  assert.equal(getRestWeek('a',3).eligible,false);
  assert.equal(canChooseRestToday(),false);
  assert.equal(computeTeamGoalThroughDay(31),6500);
  testDay=8; assert.equal(canChooseRestToday(),true);
  reset(7); assert.equal(getRestWeek('a',7).restDay,null);
  assert.equal(computeTeamGoalThroughDay(31),0);
  reset(3); entriesByUid.a[challengeKey(1)]={selected:['walking'],values:{walking:0}};
  assert.equal(getParticipationStartDay('a'),null);
  assert.equal(canChooseRestToday(),false);

  reset(2); entriesByUid.a[challengeKey(1)]=points();
  assert.equal(getRestWeek('a',2).restDay,null); // today remains open
  assert.equal(canLogToday(),true);
  testDay=3;
  assert.equal(getRestWeek('a',3).restDay,2);
  assert.equal(computeTeamGoalThroughDay(2),250);
  assert.equal(canChooseRestToday(),false);
  testDay=5;
  assert.equal(getRestWeek('a',5).restDay,2); // no second free missed day
  assert.equal(computeTeamGoalThroughDay(4),750);

  reset(7); for(let day=1;day<=6;day++) entriesByUid.a[challengeKey(day)]=points();
  assert.equal(getRestWeek('a',7).restDay,7);
  assert.equal(canLogToday(),false);
  assert.equal(computeTeamGoalThroughDay(7),1500);
  entriesByUid.a[challengeKey(7)]=points(); // legacy/malformed seventh scoring entry
  assert.equal(computePlayerTotalsForDate('a',challengeKey(7)),0);

  for(const opening of [1,8,15,22]) {
    reset(opening); assert.equal(canChooseRestToday(),true);
    entriesByUid.a[challengeKey(opening)]={rest:true};
    assert.equal(getParticipationStartDay('a'),opening);
    assert.equal(getRestWeek('a',opening).restDay,opening);
  }
  reset(29); entriesByUid.a[challengeKey(1)]=points();
  for(const day of [29,30,31]) {
    testDay=day; assert.equal(canChooseRestToday(),false);
    assert.equal(canLogToday(),true);
    assert.equal(getRestWeek('a',day).eligible,false);
  }
  assert.equal(computeTeamGoalThroughDay(31)-computeTeamGoalThroughDay(28),750);
  reset(4); entriesByUid.a[challengeKey(1)]=points();
  entriesByUid.a[challengeKey(4)]={rest:true}; // earlier miss takes precedence
  assert.equal(getRestWeek('a',4).restDay,2);
  assert.equal(isRestDay('a',challengeKey(4)),false);
  reset(); entriesByUid.a[challengeKey(8)]={rest:true}; // future data cannot start participation
  assert.equal(getParticipationStartDay('a'),null);
  reset(8); entriesByUid.a[challengeKey(1)]=points();
  assert.equal(getRestWeek('a',8).restDay,null); // new allowance
  assert.equal(canChooseRestToday(),true);
  participants.push({uid:'b',name:'B'}); entriesByUid.b={[challengeKey(8)]:{rest:true}};
  assert.equal(isRestDay('a',challengeKey(8)),false);
  assert.equal(isRestDay('b',challengeKey(8)),true);
  assert.equal(sanitizeEntries({[challengeKey(8)]:{rest:true}})[challengeKey(8)].rest,true);

  // Render actual controls against a minimal DOM, including non-interactive preview.
  els.activityGrid = document.getElementById('activityGrid');
  els.todayHeadline = document.getElementById('todayHeadline');
  els.doubleDayBadge = document.getElementById('doubleDayBadge');
  reset(); renderDailyActivities();
  assert.equal(document.getElementById('restButton').disabled,false);
  assert.equal(document.getElementById('weekSchedule').children.length,7);
  assert.ok(document.getElementById('weekSchedule').children[0].textContent.includes('Push ups'));
  entriesByUid.a[challengeKey(1)]={rest:true}; renderDailyActivities();
  assert.equal(document.getElementById('restButton').disabled,true);
  assert.ok(document.getElementById('restStatus').textContent.includes('Enjoy'));
  for(const card of els.activityGrid.children) for(const input of card.children.at(-1).children) assert.equal(input.disabled,true);
  testDay=29; renderRestSchedule();
  assert.equal(document.getElementById('weekSchedule').children.length,3);
  assert.ok(document.getElementById('restStatus').textContent.includes('no rest'));
`);
(async()=>{
 run(`
   for (let mask=0; mask<64; mask++) {
     reset(8); entriesByUid.a[challengeKey(1)]=points();
     for(let day=2;day<=7;day++) if(mask & (1 << (day-2))) entriesByUid.a[challengeKey(day)]=points();
     const rest = getRestWeek('a',1).restDay;
     assert.ok(rest >= 2 && rest <= 7);
     assert.equal(computeTeamGoalThroughDay(7),1500);
     assert.equal(computePlayerTotalsForDate('a',challengeKey(rest)),0);
     assert.equal(Array.from({length:7},(_,i)=>isRestDay('a',challengeKey(i+1))).filter(Boolean).length,1);
     assert.ok(computePlayerParticipationDays('a',challengeKey(8))>=2);
   }
 `);
 await run(`(async()=>{
   render=()=>{}; showToast=()=>{};
   reset();
   await setOwnedEntry(challengeKey(2),{rest:true,selected:[],values:{}});
   assert.equal(Object.keys(entriesByUid.a).length,0); // no future selection
   await setOwnedEntry(challengeKey(1),{rest:true,selected:[],values:{}});
   assert.equal(entriesByUid.a[challengeKey(1)].rest,true);
   entriesByUid={}; await fetchAll(); // saved Rest survives test storage/reload
   assert.equal(entriesByUid.a[challengeKey(1)].rest,true);
   await setOwnedEntry(challengeKey(1),points()); // cannot score during Rest
   assert.equal(entriesByUid.a[challengeKey(1)].rest,true);
   reset(3); await setOwnedEntry(challengeKey(3),{rest:true,selected:[],values:{}});
   assert.equal(Object.keys(entriesByUid.a).length,0); // ineligible rest blocked
   reset(); entriesByUid.a[challengeKey(1)]=points();
   await setOwnedEntry(challengeKey(1),{rest:true,selected:[],values:{}});
   assert.equal(entriesByUid.a[challengeKey(1)].rest,undefined); // points cannot be silently discarded
   pendingOwnedSaves=1; assert.equal(canLogToday(),false); assert.equal(canChooseRestToday(),false);
 })()`);
 const live = vm.createContext({assert, window:{location:{search:''}}, localStorage:{getItem:()=>null},URLSearchParams,URL,Intl,Date});
 vm.runInContext(source,live);
 await vm.runInContext(`(async()=>{
   getChallengeDateParts=()=>({year:2026,month:10,day:1});
   ownedUid='a'; participants=[{uid:'a',name:'A'}]; entriesByUid={a:{}};
   render=()=>{}; showToast=()=>{};
   let payload;
   firebaseRequest=async(path,options)=>{
     assert.equal(path,'groupChallengeOctober2026/a');
     assert.equal(options.method,'PUT'); payload=JSON.parse(options.body); return {ok:true};
   };
   await setOwnedEntry('2026-10-01',{rest:true,selected:[],values:{}});
   assert.equal(payload.entries['2026-10-01'].rest,true);
   assert.equal(sanitizeEntries(payload.entries)['2026-10-01'].rest,true);
   // A rejected save reloads server state instead of leaving a phantom Rest.
   entriesByUid={a:{}};
   firebaseRequest=async()=>({ok:false,status:403});
   fetchAll=async()=>{entriesByUid={a:{}};};
   await setOwnedEntry('2026-10-01',{rest:true,selected:[],values:{}});
   assert.equal(getParticipationStartDay('a'),null);
   assert.equal(pendingOwnedSaves,0);
 })()`,live);
 console.log('PASS: rest eligibility, first-day Rest, goals/pace, midnight, missed days, forced rest, independent participants, preview UI, guards, and save/reload.');
})().catch(error=>{console.error(error);process.exitCode=1;});
