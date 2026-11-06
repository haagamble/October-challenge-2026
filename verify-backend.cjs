const assert=require('node:assert/strict');
const {attempt,canRead,rules}=require('./rules-test-helper.cjs');
const {getConfig}=require('./challenge-config.cjs');
const {makePrivateSchedule,runJob,createRest}=require('./schedule-cheerleaders.cjs');
const {buildRules}=require('./build-month-rules.cjs');
const c=getConfig('2026-11');
let tree={settingsNovember2026:{joinOpen:true},groupChallengeOctober2026:{a:{name:'Ann'},b:{name:'Beth'}}};
const october=structuredClone(tree.groupChallengeOctober2026);
function write(updates,uid,now,expected=true){const result=attempt(tree,updates,uid,now);assert.equal(result.allowed,expected,`${uid}: ${Object.keys(updates).join(', ')}`);if(result.allowed)tree=result.after;}
const member=(name,returning)=>({name,nameKey:name.toLowerCase(),returning,cheerOptIn:true,joinedAt:{'.sv':'timestamp'}});
async function main(){
  const early=c.startAt-1000;
  write({'namesNovember2026/ann':'a'},'a',early);
  write({'groupChallengeNovember2026/a':member('Ann',true)},'a',early);
  write({'namesNovember2026/ann':'x'},'x',early,false);
  write({'groupChallengeNovember2026/x':member('Ann',false)},'x',c.startAt,false);
  write({'groupChallengeNovember2026/a/joinedAt':1},'a',c.startAt,false);
  write({'groupChallengeNovember2026/a/cheerOptIn':false},'a',c.startAt,false);
  write({'namesNovember2026/new':'new'},'new',early);
  write({'groupChallengeNovember2026/new':member('New',false)},'new',early,false);
  write({'groupChallengeNovember2026/new':member('New',true)},'new',c.startAt,false);
  write({'groupChallengeNovember2026/new':{...member('New',false),joinedAt:0}},'new',c.startAt,false);
  write({'groupChallengeNovember2026/new':member('New',false)},'new',c.startAt);
  const entry={selected:['pushups'],values:{pushups:5}};
  write({'groupChallengeNovember2026/a/entries/2026-11-01':entry},'a',early,false);
  write({'groupChallengeNovember2026/a/entries/2026-11-01':entry},'a',c.startAt);
  write({'groupChallengeNovember2026/a/entries/2026-11-01':entry},'b',c.startAt,false);
  write({'groupChallengeNovember2026/a/entries/2026-11-02':entry},'a',c.startAt,false);
  write({'groupChallengeNovember2026/a/entries/2026-11-01':entry},'a',c.cutoff,false);
  write({'groupChallengeNovember2026/a/entries/2026-11-01':{selected:['pushups','pushups'],values:{pushups:5}}},'a',c.startAt,false);
  write({'groupChallengeNovember2026/a/entries/2026-11-01':{selected:['other'],values:{other:101}}},'a',c.startAt,false);
  write({'groupChallengeNovember2026/a/entries/2026-11-01':{rest:true}},'a',c.startAt);
  write({'groupChallengeNovember2026/a/entries/2026-11-01':null},'a',c.startAt,false);
  tree[c.privatePath]=makePrivateSchedule(tree[c.roster],c.month,c.cutoff);
  assert.equal(canRead(tree,c.privatePath,'a'),false);
  assert.equal(canRead(tree,`${c.privatePath}/status`,'a'),true);
  assert.equal(canRead(tree,`${c.privatePath}/users/a`,'a'),true);
  assert.equal(canRead(tree,`${c.privatePath}/users/new`,'a'),false);
  const uid=Object.keys(tree[c.privatePath].users).find(uid=>tree[c.privatePath].users[uid].dates['2026-11-02']);
  const claimPath=`${c.privatePath}/users/${uid}/claims/2026-11-02`,bonusPath=`${c.bonusPath}/2026-11-02`;
  const claim=status=>({uid,status});
  write({[claimPath]:claim('accepted')},uid,c.cutoff,false);
  write({[claimPath]:claim('claimed'),[bonusPath]:100},uid,c.cutoff,false);
  write({[claimPath]:claim('accepted'),[bonusPath]:0},uid,c.cutoff);
  write({[claimPath]:claim('claimed'),[bonusPath]:100},uid,c.cutoff);
  const clubPath=`club400November2026/2026-11-02/${uid}`;
  const activityPath=`${c.roster}/${uid}/entries/2026-11-02`;
  const threeHundred={selected:['pushups','squats','situps'],values:{pushups:50,squats:100,situps:100}};
  write({[clubPath]:true},uid,c.cutoff,false);
  write({[activityPath]:threeHundred,[clubPath]:true},uid,c.cutoff);
  write({[activityPath]:{...threeHundred,values:{pushups:49,squats:100,situps:100}}},uid,c.cutoff,false);
  assert.equal(canRead(tree,clubPath,'spectator'),true);
  write({[bonusPath]:0},uid,c.cutoff,false);
  write({[claimPath]:claim('claimed'),[bonusPath]:100},uid,c.cutoff);
  write({[claimPath]:claim('passed'),[bonusPath]:0},uid,c.cutoff,false);
  write({[claimPath]:claim('accepted'),[bonusPath]:0},uid,c.cutoff,false);
  write({[claimPath]:claim('accepted'),[bonusPath]:0,[clubPath]:null},uid,c.cutoff);
  write({[claimPath]:claim('accepted'),[bonusPath]:0},'intruder',c.cutoff,false);
  write({[`${c.privatePath}/users/${uid}/dates/2026-11-02`]:{uid}},uid,c.cutoff,false);
  write({'groupChallengeOctober2026/a/name':'Ann'},'a',c.startAt-1);
  write({'groupChallengeOctober2026/a/name':'Ann'},'a',c.startAt,false);
  assert.deepEqual(tree.groupChallengeOctober2026,october);
  assert.deepEqual(buildRules({rules}),{rules});
  for(const size of [0,1,3,10,40]){
    const roster=Object.fromEntries(Array.from({length:size},(_,i)=>[`p${i}`,{joinedAt:c.startAt,cheerOptIn:true}]));
    roster.late={joinedAt:c.cutoff,cheerOptIn:true};roster.out={joinedAt:c.startAt,cheerOptIn:false};
    const schedule=makePrivateSchedule(roster,c.month,c.cutoff);
    assert.equal(schedule.users.late,undefined);assert.equal(schedule.users.out,undefined);
    const counts=Object.values(schedule.users).map(member=>Object.keys(member.dates).length);
    assert.equal(counts.reduce((a,b)=>a+b,0),size?29:0);
    if(size)assert.ok(Math.max(...counts)-Math.min(...counts)<=1);
  }
  let saved=null,version=0,writes=0,clubUpdates={};
  const rest=async(path,options={})=>{
    if(path==='club400November2026'&&options.method==='PATCH'){Object.assign(clubUpdates,JSON.parse(options.body));return {status:200};}
    assert.ok([c.privatePath,c.settings,c.roster].includes(path));
    if(options.method==='PUT'){
      if(options.headers['if-match']!==`"v${version}"`)return {status:412};
      saved=JSON.parse(options.body);version++;writes++;return {status:200};
    }
    const value=path===c.privatePath?structuredClone(saved):path===c.settings?{joinOpen:true}:tree[c.roster],etag=`"v${version}"`;
    return {json:async()=>value,headers:{get:()=>etag}};
  };
  await runJob({rest,mode:'check'});assert.equal(writes,0);
  await runJob({rest,mode:'generate',now:c.cutoff-1});assert.equal(writes,0);
  await Promise.all([runJob({rest,mode:'generate',now:c.cutoff}),runJob({rest,mode:'generate',now:c.cutoff})]);assert.equal(writes,1);
  await runJob({rest,mode:'generate',now:c.cutoff+86400000});assert.equal(writes,1);
  const assigned=Object.keys(saved.users).find(id=>saved.users[id].dates['2026-11-02']);
  saved.users[assigned].claims={'2026-11-02':{uid:assigned,status:'claimed'}};
  await runJob({rest,mode:'generate',now:c.cutoff+86400000});
  assert.equal(clubUpdates[`2026-11-02/${assigned}`],true);assert.equal(writes,1);
  assert.throws(()=>createRest({url:'http://example.com/',token:'x'}),/HTTPS origin/);
  console.log('PASS: Spark rules, server timestamps, unique names, owner/day guards, October cutoff, private reads, atomic bonuses, balanced scheduling and ETag concurrency.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
