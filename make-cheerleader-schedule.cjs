const fs = require('node:fs');
const crypto = require('node:crypto');
function assignment(uid, day) {
  if (typeof uid !== 'string' || !uid || /[.#$\[\]\/]/.test(uid)) throw Error('Invalid participant ID');
  // All October 2026 Pacific midnights are UTC-07:00, including Nov 1 midnight.
  return {uid, startAt:Date.UTC(2026,9,day,7),endAt:Date.UTC(2026,9,day+1,7)};
}
function makeSchedule(roster, firstUid) {
  const ids = Object.keys(roster).filter(uid => typeof roster[uid]?.name === 'string' && roster[uid].name.trim());
  if (!ids.includes(firstUid)) throw Error('October 1 participant must be in the frozen roster');
  const rank = uid => crypto.createHash('sha256').update('October2026:'+uid).digest('hex');
  ids.sort((a,b)=>rank(a).localeCompare(rank(b)));
  const counts=Object.fromEntries(ids.map(uid=>[uid,0]));
  const result={};
  for(let day=1;day<=31;day++) {
    const uid=day===1 ? firstUid : ids.reduce((best,id)=>counts[id]<counts[best]?id:best,ids[0]);
    result['2026-10-'+String(day).padStart(2,'0')]=assignment(uid,day);counts[uid]++;
  }
  return result;
}
module.exports={assignment,makeSchedule};
if(require.main===module) {
  const [input,firstUid,output]=process.argv.slice(2);
  if(!input || !firstUid || !output) throw Error('Usage: node make-cheerleader-schedule.cjs <frozen-roster.json|--first-day> <October-1-UID> <output.json>');
  const schedule=input==='--first-day' ? {'2026-10-01':assignment(firstUid,1)} : makeSchedule(JSON.parse(fs.readFileSync(input,'utf8')),firstUid);
  fs.writeFileSync(output,JSON.stringify(schedule,null,2)+'\n',{flag:'wx'});
  console.log('Schedule saved locally. No Firebase writes or Git commands were performed.');
}
