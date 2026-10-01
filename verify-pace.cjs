const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const ctx=vm.createContext({assert,window:{location:{search:'?test=1'}},localStorage:{getItem:()=>null},URLSearchParams,Date,Intl});
vm.runInContext(fs.readFileSync(path.join(__dirname,'group-challenge.js'),'utf8').replace(/init\(\);\s*$/,'')+'\n'+fs.readFileSync(path.join(__dirname,'cheerleader.js'),'utf8'),ctx);
vm.runInContext(`
 let day=1;getChallengeDateParts=()=>({year:2026,month:10,day});
 for(const id of ['teamToday','teamTodayRemaining','teamMonth','goalPace','goalText','goalBar','goalMessage','goalTodayTarget','goalYesterday']) els[id]={style:{},classList:{toggle(){}}};
 participants=Array.from({length:9},(_,i)=>({uid:String(i),name:'Person '+i}));
 const active=['0','1','2'];entriesByUid={};
 getDoubleActivityId=()=> 'strength';
 const onPace=()=>({selected:['strength','walking','dancing'],values:{strength:25,walking:40,dancing:25}});
 for(const uid of active)entriesByUid[uid]={'2026-10-01':onPace()};
 renderGoalMeta();assert.equal(computeTeamGoalThroughDay(31),20250);
 assert.ok(els.goalMessage.textContent.includes('250 points per person per remaining scoring day'));
 day=2;renderGoalMeta();assert.ok(els.goalMessage.textContent.includes('250 points'));
 // Ahead / behind, measured through yesterday, not diluted by people yet to start.
 for(const uid of active)entriesByUid[uid]['2026-10-01'].values.strength=100;
 renderGoalMeta();assert.ok(els.goalMessage.textContent.includes('245 points'));
 for(const uid of active)entriesByUid[uid]['2026-10-01']={selected:['walking'],values:{walking:2}};
 renderGoalMeta();assert.ok(els.goalMessage.textContent.includes('260 points'));
 // First-day rest has no completed scoring-day contribution.
 for(const uid of active)entriesByUid[uid]['2026-10-01']={rest:true};
 renderGoalMeta();assert.ok(els.goalMessage.textContent.includes('250 points'));
 // Cheerleader bonuses reduce what remains without adding scoring days.
 cheerSchedule={'2026-10-01':{uid:'0'}};cheerClaims={'2026-10-01':{uid:'0',status:'claimed'}};
 renderGoalMeta();assert.ok(els.goalMessage.textContent.includes('249 points'));
 cheerSchedule={};cheerClaims={};entriesByUid={};day=3;
 entriesByUid['0']={'2026-10-03':onPace()};renderGoalMeta();
 assert.equal(computeTeamGoalThroughDay(31),6500);assert.ok(els.goalMessage.textContent.includes('250 points'));
 entriesByUid={};renderGoalMeta();assert.ok(!els.goalMessage.textContent.includes('NaN'));assert.ok(!els.goalMessage.textContent.includes('Infinity'));
`,ctx);
console.log('PASS: 3 starters / 9 joined = 250, ahead/behind pace, rest allowance, bonus, late start and empty goal.');
