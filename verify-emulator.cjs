const assert=require('node:assert/strict'),fs=require('node:fs');
const {getConfig}=require('./challenge-config.cjs');
const {makePrivateSchedule}=require('./schedule-cheerleaders.cjs');
const c=getConfig('2026-11');
const dbHost=process.env.FIREBASE_DATABASE_EMULATOR_HOST,authHost=process.env.FIREBASE_AUTH_EMULATOR_HOST;
if(!/^127\.0\.0\.1:\d+$/.test(dbHost||'')||!/^127\.0\.0\.1:\d+$/.test(authHost||''))throw new Error('Tests require loopback emulators. Refusing any non-local database.');
const original=fs.readFileSync('database.rules.json','utf8');
async function request(path,{token,admin=false,method='GET',value}={}) {
  return fetch(`http://${dbHost}/${path}.json?ns=demo-group-fit-default-rtdb${token?`&auth=${encodeURIComponent(token)}`:''}`,{
    method,headers:{'Content-Type':'application/json',...(admin?{Authorization:'Bearer owner'}:{})},
    ...(value!==undefined?{body:JSON.stringify(value)}:{})});
}
async function allowed(path,options={}){const response=await request(path,options);assert.equal(response.ok,true,`${options.method||'GET'} ${path}: ${response.status} ${!response.ok?await response.text():''}`);return response.json();}
async function denied(path,options={}){const response=await request(path,options);assert.equal(response.ok,false,`${path} should be denied`);assert.ok([401,403].includes(response.status));}
async function rulesAt(time){
  const text=time===undefined?original:original.replace(/\bnow\b/g,String(time));
  await allowed('.settings/rules',{admin:true,method:'PUT',value:JSON.parse(text)});
}
async function signup(){const response=await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({returnSecureToken:true})});assert.equal(response.ok,true);return response.json();}
async function main(){
  await rulesAt();
  const [a,b]=await Promise.all([signup(),signup()]);
  const seed={settingsNovember2026:{joinOpen:true},groupChallengeOctober2026:{[a.localId]:{name:'Ann'},[b.localId]:{name:'Beth'}}};
  await allowed('',{admin:true,method:'PUT',value:seed});
  await allowed('namesNovember2026/ann',{token:a.idToken,method:'PUT',value:a.localId});
  await denied('namesNovember2026/ann',{token:b.idToken,method:'PUT',value:b.localId});
  const record={name:'Ann',nameKey:'ann',returning:true,cheerOptIn:true,joinedAt:{'.sv':'timestamp'}};
  // Real server timestamp validation uses the emulator's own clock. Temporarily
  // remove only creation's date window so this test can run after November too.
  const timestampRules=JSON.parse(original);
  timestampRules.rules.groupChallengeNovember2026.$uid['.write']="auth != null && auth.uid === $uid && !data.exists() && newData.exists() && root.child('settingsNovember2026/joinOpen').val() === true";
  await allowed('.settings/rules',{admin:true,method:'PUT',value:timestampRules});
  await denied(`groupChallengeNovember2026/${a.localId}`,{token:a.idToken,method:'PUT',value:{...record,joinedAt:0}});
  const joined=await allowed(`groupChallengeNovember2026/${a.localId}`,{token:a.idToken,method:'PUT',value:record});
  assert.equal(typeof joined.joinedAt,'number');assert.ok(Math.abs(joined.joinedAt-Date.now())<10000);
  await rulesAt(c.startAt);
  const entry={selected:['pushups'],values:{pushups:5}};
  const entryPath=`groupChallengeNovember2026/${a.localId}/entries/2026-11-01`;
  await allowed(entryPath,{token:a.idToken,method:'PUT',value:entry});
  await denied(entryPath,{token:b.idToken,method:'PUT',value:entry});
  await denied(entryPath,{token:a.idToken,method:'PUT',value:{selected:['other'],values:{other:101}}});
  await denied(`groupChallengeNovember2026/${a.localId}/joinedAt`,{token:a.idToken,method:'PUT',value:0});
  await denied('groupChallengeOctober2026/'+a.localId+'/name',{token:a.idToken,method:'PUT',value:'Ann'});
  await rulesAt(c.startAt-1);
  await allowed('groupChallengeOctober2026/'+a.localId+'/name',{token:a.idToken,method:'PUT',value:'Ann'});
  await rulesAt(c.cutoff);
  await denied(entryPath,{token:a.idToken,method:'PUT',value:entry});
  const roster={[a.localId]:{joinedAt:c.startAt,cheerOptIn:true},[b.localId]:{joinedAt:c.startAt,cheerOptIn:true}};
  const schedule=makePrivateSchedule(roster,c.month,c.cutoff);
  await allowed(c.privatePath,{admin:true,method:'PUT',value:schedule});
  await denied('',{token:a.idToken});
  await denied(c.privatePath,{token:a.idToken});
  await denied(`${c.privatePath}/users/${b.localId}`,{token:a.idToken});
  await allowed(`${c.privatePath}/users/${a.localId}`,{token:a.idToken});
  await allowed(`${c.privatePath}/status`,{token:a.idToken});
  const uid=Object.keys(schedule.users).find(uid=>schedule.users[uid].dates['2026-11-02']);
  const owner=uid===a.localId?a:b,other=uid===a.localId?b:a;
  const path=`${c.privatePath}/users/${uid}/claims/2026-11-02`,bonus=`${c.bonusPath}/2026-11-02`;
  const update=status=>({[path]:{uid,status},[bonus]:status==='claimed'?100:0});
  await denied('',{token:other.idToken,method:'PATCH',value:update('accepted')});
  await denied('',{token:owner.idToken,method:'PATCH',value:update('claimed')});
  await denied(path,{token:owner.idToken,method:'PUT',value:{uid,status:'accepted'}});
  await allowed('',{token:owner.idToken,method:'PATCH',value:update('accepted')});
  await allowed('',{token:owner.idToken,method:'PATCH',value:update('claimed')});
  if(uid===b.localId)await allowed(`${c.roster}/${uid}`,{admin:true,method:'PUT',value:{name:'Beth',nameKey:'beth',returning:true,cheerOptIn:true,joinedAt:c.startAt}});
  const club=`club400November2026/2026-11-02/${uid}`,activityPath=`${c.roster}/${uid}/entries/2026-11-02`;
  const threeHundred={selected:['pushups','squats','situps'],values:{pushups:50,squats:100,situps:100}};
  await denied(club,{token:owner.idToken,method:'PUT',value:true});
  await allowed('',{token:owner.idToken,method:'PATCH',value:{[activityPath]:threeHundred,[club]:true}});
  assert.equal(await allowed(club,{token:other.idToken}),true);
  await denied(activityPath,{token:owner.idToken,method:'PUT',value:{...threeHundred,values:{pushups:49,squats:100,situps:100}}});
  await denied(bonus,{token:owner.idToken,method:'PUT',value:0});
  await denied('',{token:owner.idToken,method:'PATCH',value:update('accepted')});
  await allowed('',{token:owner.idToken,method:'PATCH',value:{...update('accepted'),[club]:null}});
  assert.equal(await allowed(bonus,{token:other.idToken}),0);
  assert.deepEqual(await allowed('groupChallengeOctober2026',{admin:true}),seed.groupChallengeOctober2026);
  console.log('PASS: actual Firebase emulator compiles rules and verifies server timestamps, names, owner/date limits, private assignments, atomic claim totals, and October boundary/isolation.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>rulesAt());
