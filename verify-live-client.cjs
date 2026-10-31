const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {attempt,canRead}=require('./rules-test-helper.cjs');
const {getConfig}=require('./challenge-config.cjs');
const c=getConfig('2026-11');
const source=fs.readFileSync('cheerleader.js','utf8')+'\n'+fs.readFileSync('group-challenge.js','utf8').replace(/init\(\);\s*$/,'');
let now=c.startAt,tree={settingsNovember2026:{joinOpen:true},groupChallengeOctober2026:{a:{name:'Ann'}}};
const requests=[];
const context=vm.createContext({Intl,Date,URL,URLSearchParams,console,
  window:{location:{hostname:'example.test',protocol:'https:',search:'?month=2026-11'},GROUP_CHALLENGE_FIREBASE_CONFIG:{databaseURL:'https://example.invalid',apiKey:'test'}},
  localStorage:{getItem:()=>null,setItem(){}},fetch:async(url,options={})=>{
    const parsed=new URL(url);assert.equal(parsed.origin,'https://example.invalid');assert.equal(parsed.searchParams.get('auth'),'saved-token');
    const path=decodeURIComponent(parsed.pathname.slice(1,-5)),method=options.method||'GET';
    requests.push({path,method});
    let allowed,value;
    if(method==='GET') {allowed=canRead(tree,path,'a');value=path.split('/').reduce((value,key)=>value?.[key],tree)??null;}
    else {
      const body=options.body?JSON.parse(options.body):null;
      const result=attempt(tree,method==='PATCH'?body:{[path]:body},'a',now);
      allowed=result.allowed;if(allowed)tree=result.after;value=body;
    }
    return {ok:allowed,status:allowed?200:403,headers:{get:()=>new Date(now).toUTCString()},json:async()=>structuredClone(value)};
  }});
vm.runInContext(source,context);
const run=code=>vm.runInContext(code,context);
async function main(){
  run("authSession={localId:'a',idToken:'saved-token',expiresAt:Date.now()+3600000};");
  await run('fetchAll()');assert.equal(run('ownedUid'),'a');assert.equal(run('participants.length'),0);
  await run("joinLiveMonth('Ann',true)");
  assert.equal(run('participants[0].uid'),'a');assert.equal(run('participants[0].joinedAt'),now);
  assert.equal(run("getParticipationStartDay('a')"),1);assert.equal(run('computeTeamGoalThroughDay(30)'),6500);
  assert.equal(run('AUTH_STORAGE_KEY'),'october-2026-group-challenge-firebase-auth:https://example.invalid');
  const joins=requests.filter(request=>request.path==='groupChallengeNovember2026/a'&&request.method==='PUT').length;
  await run("joinLiveMonth('Ann',false)");
  assert.equal(requests.filter(request=>request.path==='groupChallengeNovember2026/a'&&request.method==='PUT').length,joins);
  assert.equal(run('participants[0].cheerOptIn'),true);
  run("entriesByUid.a['2026-11-01']={selected:['pushups'],values:{pushups:5}};");
  await run("saveOwnedRecord('2026-11-01')");assert.equal(tree.groupChallengeNovember2026.a.entries['2026-11-01'].values.pushups,5);
  now=Date.parse('2026-11-03T20:00:00Z');
  tree.groupChallengeNovember2026.a.entries={};
  tree.groupChallengeNovember2026.b={name:'Beth',returning:true,joinedAt:c.startAt,cheerOptIn:true,entries:{'2026-11-02':{selected:['pushups'],values:{pushups:5}}}};
  tree[c.privatePath]={status:{generatedAt:c.cutoff},users:{a:{dates:{'2026-11-02':{uid:'a'}},claims:{'2026-11-02':{uid:'a',status:'claimed'}}},b:{dates:{'2026-11-03':{uid:'b'}}}}};
  tree[c.bonusPath]={'2026-11-02':100,'2026-11-03':100};
  await run('fetchAll()');
  assert.equal(run('actualTodayKey()'),'2026-11-03');
  assert.equal(run('computeMonthTotal()'),210);assert.equal(run("computePlayerMonthTotal('a')"),100);
  assert.equal(run("computeTeamTotalForDate(new Date('2026-11-02T00:00:00Z'))"),110);
  assert.equal(run("computeMonthTotalBeforeDate('2026-11-03')"),110);
  assert.equal(run("cheerSchedule['2026-11-03']"),undefined);
  await assert.rejects(run("saveOwnedRecord('2026-11-02')"),/Only today/);
  const before=requests.length;run('pendingOwnedSaves=1;');await run('fetchAll()');assert.equal(requests.length,before);
  assert.ok(!requests.some(request=>request.path===c.privatePath||request.path.includes('/users/b')));
  assert.deepEqual(tree.groupChallengeOctober2026,{a:{name:'Ann'}});
  console.log('PASS: direct Spark REST, same UID/auth key, server timestamps, idempotent joining, private-only fetches, complete team totals, stale-date rejection and polling guard.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
