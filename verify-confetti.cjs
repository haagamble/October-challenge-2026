const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let bursts=0,reduced=false;
const events={};
const document={visibilityState:'visible',addEventListener:(name,fn)=>events[name]=fn,
  createElement:()=>({style:{setProperty(){}},setAttribute(){},appendChild(){},remove(){}}),body:{appendChild(){bursts++;}}};
const context=vm.createContext({document,URLSearchParams,URL,Intl,Date,Math,
  localStorage:{getItem:()=>null},window:{location:{search:'?test=1&month=2026-10'},matchMedia:()=>({matches:reduced}),setTimeout(){}}});
vm.runInContext(fs.readFileSync('group-challenge.js','utf8').replace(/init\(\);\s*$/,''),context);
const run=code=>vm.runInContext(code,context);
run('let reached = false; renderGoalMeta = () => {if(reached) celebrateGoalReached();}; loadState="ready"; setupGoalCelebrationReplay();');
events.visibilitychange();assert.equal(bursts,0);
run('reached=true; renderGoalMeta(); renderGoalMeta();');assert.equal(bursts,1);
document.visibilityState='hidden';events.visibilitychange();run('renderGoalMeta();');assert.equal(bursts,1);
document.visibilityState='visible';events.visibilitychange();assert.equal(bursts,2);
events.visibilitychange();run('renderGoalMeta();');assert.equal(bursts,2);
reduced=true;document.visibilityState='hidden';events.visibilitychange();document.visibilityState='visible';events.visibilitychange();assert.equal(bursts,2);
reduced=false;document.visibilityState='hidden';events.visibilitychange();run('reached=false;');document.visibilityState='visible';events.visibilitychange();assert.equal(bursts,2);
console.log('PASS: confetti on reaching goal and returning to app, no repeats during normal updates, no hidden animation, and reduced motion respected.');
