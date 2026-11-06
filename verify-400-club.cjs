const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {activityPoints}=require('./club400.cjs');
const source=fs.readFileSync('cheerleader.js','utf8')+'\n'+fs.readFileSync('group-challenge.js','utf8').replace(/init\(\);\s*$/,'');
const context=vm.createContext({URLSearchParams,URL,Intl,Date,window:{location:{hostname:'example.test',search:'?month=2026-11'}},localStorage:{getItem:()=>null}});
const run=code=>vm.runInContext(code,context);
vm.runInContext(source,context);
run(`getChallengeDateParts=()=>({year:2026,month:11,day:6});
participants=[{uid:'a',name:'Ann',returning:true,startDate:'2026-11-01'},{uid:'b',name:'Beth',returning:true,startDate:'2026-11-01'}];
entriesByUid={a:{'2026-11-05':{selected:['squats','situps','plank'],values:{squats:100,situps:100,plank:300}}},b:{'2026-11-05':{selected:['squats','situps','plank'],values:{squats:100,situps:100,plank:300}}}};
ownedUid='a';cheerSchedule={'2026-11-05':{uid:'a'}};cheerClaims={'2026-11-05':{uid:'a',status:'claimed'}};`);
assert.equal(run("computePlayerTotalsForDate('a','2026-11-05')"),300);
assert.equal(run("is400ClubMember('a','2026-11-05')"),true);
assert.equal(run("is400ClubMember('b','2026-11-05')"),false);
run("bonusClubMembers={'2026-11-05':{b:true}};");
assert.equal(run("is400ClubMember('b','2026-11-05')"),true,'Other viewers use only the public qualification, not private assignments');
run("entriesByUid.b['2026-11-05'].values.plank=270;");
assert.equal(run("is400ClubMember('b','2026-11-05')"),false);
run("cheerClaims['2026-11-05'].status='accepted';");
assert.equal(run("is400ClubMember('a','2026-11-05')"),false);
run("entriesByUid.a['2026-11-05']={selected:['pushups','squats','situps'],values:{pushups:50,squats:100,situps:100}};");
assert.equal(run("is400ClubMember('a','2026-11-05')"),true,'400 activity points still qualify without a bonus');
for(let day=1;day<=30;day++){
  const date=`2026-11-${String(day).padStart(2,'0')}`;
  for(const selected of [['pushups','squats','situps'],['walking','plank','other'],['pullups','stairs','dancing']]){
    const entry={selected,values:Object.fromEntries(selected.map(id=>[id,id==='other'?99:37])),pullupType:selected.includes('pullups')?'modified':undefined};
    run(`entriesByUid.a[${JSON.stringify(date)}]=${JSON.stringify(entry)};`);
    assert.equal(run(`computeRawPlayerPoints('a',${JSON.stringify(date)})`),activityPoints(entry,date));
  }
}
console.log('PASS: 300+claimed100, unclaimed/under400 exclusion, private/public qualification, unchanged activity-only qualification, and scoring parity across November.');
