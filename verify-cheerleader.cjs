const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const {assignment,makeSchedule}=require('./make-cheerleader-schedule.cjs');
const source=fs.readFileSync(path.join(__dirname,'group-challenge.js'),'utf8').replace(/init\(\);\s*$/,'')+'\n'+fs.readFileSync(path.join(__dirname,'cheerleader.js'),'utf8');
const nodes=new Map(),storage=new Map();
const document={getElementById(id){if(!nodes.has(id)) nodes.set(id,{classList:{toggle(){}},textContent:''});return nodes.get(id);}};
const c=vm.createContext({assert,document,window:{location:{search:'?test=1'}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},URLSearchParams,URL,Intl,Date});vm.runInContext(source,c);
const run=code=>vm.runInContext(code,c);
(async()=>{
 await run(`(async()=>{
   let day=1; getChallengeDateParts=()=>({year:2026,month:10,day});
   participants=[{uid:'a',name:'A'},{uid:'b',name:'B'}];ownedUid='a';entriesByUid={a:{},b:{}};
   cheerSchedule={'2026-10-01':{uid:'a'}};cheerReady=true;loadState='ready';
   render=()=>{};showToast=()=>{};
   renderCheerleader();assert.equal(document.getElementById('cheerleaderAccept').disabled,false);
   await updateCheerleader('claimed'); assert.equal(cheerBonus('a','2026-10-01'),0);
   ownedUid='b';await updateCheerleader('accepted');assert.equal(Object.keys(cheerClaims).length,0);
   ownedUid='a';await updateCheerleader('passed');assert.equal(cheerStatus('2026-10-01'),'passed');
   await updateCheerleader('accepted');await updateCheerleader('claimed');await updateCheerleader('claimed');
   assert.equal(cheerBonus('a','2026-10-01'),100);
   assert.equal(computeMonthTotal(),100);assert.equal(computeTeamTotalForDate(getCurrentDate()),100);
   assert.equal(computeTeamGoalThroughDay(31),0);assert.equal(getParticipationStartDay('a'),null);
   assert.equal(computePlayerDailyAverage('a'),0);assert.equal(computePlayerTotalsForDate('a','2026-10-01'),0);
   assert.equal(canChooseRestToday(),true);
   entriesByUid.a['2026-10-01']={rest:true,selected:[],values:{}};
   assert.equal(computeTeamGoalThroughDay(31),6750);assert.equal(isRestDay('a','2026-10-01'),true);
   assert.equal(computeMonthTotal(),100);
   await saveOwnedRecord();cheerClaims={};cheerSchedule={};await fetchAll();
   assert.equal(cheerBonus('a','2026-10-01'),100);
   await updateCheerleader('accepted');assert.equal(computeMonthTotal(),0);
   entriesByUid.a['2026-10-01']={selected:['strength','walking','dancing'],values:{strength:100,walking:50,dancing:25}};
   // Make this fixture independent of organizer schedule edits.
   const oldDouble=getDoubleActivityId;getDoubleActivityId=()=> 'strength';
   await updateCheerleader('claimed');assert.equal(computePlayerTotalsForDate('a','2026-10-01'),400);
   assert.equal(computePlayerMonthTotal('a'),500);assert.equal(computeTeamGoalThroughDay(31),6750);
   day=2;assert.equal(computeMonthTotalBeforeDate('2026-10-02'),500);
   await updateCheerleader('accepted');assert.equal(cheerBonus('a','2026-10-01'),100);
   assert.equal(getRestWeek('a',2).restDay,null);day=3;assert.equal(getRestWeek('a',3).restDay,2);
   getDoubleActivityId=oldDouble;
   cheerSchedule['2026-10-04']={uid:'a'};cheerClaims['2026-10-04']={uid:'a',status:'claimed'};
   assert.equal(cheerBonus('a','2026-10-04'),0);
   cheerSchedule['2026-10-01']={uid:'b'};assert.equal(cheerBonus('a','2026-10-01'),0);
   cheerReady=false;assert.equal(canUpdateCheerleader('2026-10-03'),false);
 })()`);
 const live=vm.createContext({assert,document,window:{location:{search:''}},localStorage:{getItem:()=>null},URLSearchParams,URL,Intl,Date});vm.runInContext(source,live);
 await vm.runInContext(`(async()=>{
   getChallengeDateParts=()=>({year:2026,month:10,day:1});ownedUid='a';cheerReady=true;
   cheerSchedule={'2026-10-01':{uid:'a'}};render=()=>{};showToast=()=>{};
   let writes=0;firebaseRequest=async(path,options)=>{assert.equal(path,'cheerleaderClaimsOctober2026/2026-10-01');assert.equal(JSON.parse(options.body).uid,'a');writes++;return {ok:false};};
   await updateCheerleader('accepted');assert.equal(cheerStatus('2026-10-01'),'assigned');
   firebaseRequest=async()=>{writes++;return {ok:true};};await updateCheerleader('accepted');await updateCheerleader('claimed');
   assert.equal(cheerBonus('a','2026-10-01'),100);
   firebaseRequest=async()=>{throw Error('offline')};await fetchCheerleader();
   assert.equal(cheerReady,false);assert.equal(cheerBonus('a','2026-10-01'),100);
 })()`,live);
 // Evaluate the actual rule expressions with Firebase-like snapshots. This is
 // a local expression check, not a substitute for the Firebase Rules Playground.
 const rules=JSON.parse(fs.readFileSync(path.join(__dirname,'database.rules.json'))).rules;
 const rule=rules.cheerleaderClaimsOctober2026.$date;
 function snap(value){return {val:()=>value??null,exists:()=>value!==undefined&&value!==null,isNumber:()=>typeof value==='number',isString:()=>typeof value==='string',child:p=>snap(p.split('/').reduce((v,k)=>v?.[k],value)),hasChildren:keys=>keys.every(k=>value?.[k]!==undefined&&value[k]!==null)};}
 const assign=assignment('a',1);
 function allowed(uid,now,previous,next){
  const ctx={auth:uid?{uid}:null,now,$date:'2026-10-01',root:snap({groupChallengeOctober2026:{a:{name:'A'},b:{name:'B'}},cheerleaderScheduleOctober2026:{'2026-10-01':assign}}),data:snap(previous),newData:snap(next)};
  const evaluate=(expr,ctx)=>vm.runInNewContext(expr.replace(/\.matches\((\/.*?\/)\)/g,'.match($1)'),ctx);
  if(!evaluate(rule['.write'],ctx))return false;
  if(!evaluate(rule['.validate'],ctx))return false;
  return Object.keys(next).every(k=>rule[k] && evaluate(rule[k]['.validate'],{...ctx,newData:snap(next[k])}));
 }
 const accepted={uid:'a',status:'accepted'},claimed={uid:'a',status:'claimed'};
 assert.equal(rules.cheerleaderScheduleOctober2026['.write'],false);
 assert.equal(allowed('a',assign.startAt,null,accepted),true);
 assert.equal(allowed('a',assign.startAt,accepted,claimed),true);
 assert.equal(allowed('a',assign.startAt,claimed,claimed),true);
 assert.equal(allowed('a',assign.startAt,claimed,accepted),true);
 assert.equal(allowed('a',assign.startAt,null,claimed),false);
 assert.equal(allowed('b',assign.startAt,null,{uid:'b',status:'accepted'}),false);
 assert.equal(allowed(null,assign.startAt,null,accepted),false);
 assert.equal(allowed('a',assign.startAt-1,null,accepted),false);
 assert.equal(allowed('a',assign.endAt,null,accepted),false);
 assert.equal(allowed('a',assign.startAt,claimed,null),false);
 assert.equal(allowed('a',assign.startAt,null,{...accepted,points:10000}),false);
 assert.equal(allowed('a',assign.startAt,null,{uid:'b',status:'accepted'}),false);
 for(const size of [1,2,3,10,40]){
  const roster=Object.fromEntries(Array.from({length:size},(_,i)=>['test'+i,{name:'Person '+i}]));
  const schedule=makeSchedule(roster,'test0');const counts=Object.fromEntries(Object.keys(roster).map(uid=>[uid,0]));
  assert.equal(Object.keys(schedule).length,31);assert.equal(schedule['2026-10-01'].uid,'test0');
  for(const [date,entry] of Object.entries(schedule)){
   counts[entry.uid]++;assert.equal(entry.endAt-entry.startAt,86400000);
   assert.equal(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(entry.startAt)),date);
  }
  assert.ok(Math.max(...Object.values(counts))-Math.min(...Object.values(counts))<=1);
  assert.deepEqual(makeSchedule(roster,'test0'),schedule);
 }
 console.log('PASS: cheerleader UI/status, claims, undo, duplicate prevention, bonus separation, reload, failure handling, rule expressions, and balanced Pacific-date schedule.');
})().catch(error=>{console.error(error);process.exitCode=1;});
