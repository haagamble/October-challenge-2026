// Runs on GitHub's standard runner. No Firebase Functions, SDK, or key file.
const {createHash} = require('node:crypto');
const {getConfig,pacificMidnight} = require('./challenge-config.cjs');
function makePrivateSchedule(roster, month, now) {
  const config = getConfig(month);
  if (now < config.cutoff) throw new Error('The Pacific joining cutoff has not passed.');
  const ids = Object.keys(roster || {}).filter(uid => {
    const member = roster[uid];
    return member.cheerOptIn === true && Number.isFinite(member.joinedAt) && member.joinedAt < config.cutoff;
  });
  const rank = uid => createHash('sha256').update(`${month}:${uid}`).digest('hex');
  ids.sort((a,b)=>rank(a).localeCompare(rank(b)));
  const users = {};
  for (const uid of ids) users[uid] = {dates:{}};
  if (ids.length) for (let day=2;day<=config.days;day++) {
    const uid = ids[(day-2)%ids.length];
    users[uid].dates[`${month}-${String(day).padStart(2,'0')}`] = {
      uid,startAt:pacificMidnight(2026,10,day),endAt:pacificMidnight(2026,10,day+1)
    };
  }
  return {status:{generatedAt:now,cutoff:config.cutoff},users};
}
function createRest({url, token, fetchImpl = fetch}) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !/^[a-z0-9-]+\.(firebaseio\.com|[a-z0-9-]+\.firebasedatabase\.app)$/.test(parsed.hostname) || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error('Expected a Firebase Realtime Database HTTPS origin.');
  if (!token) throw new Error('Missing temporary Firebase access token.');
  return async (path, options = {}) => {
    const {headers, ...rest} = options;
    const response = await fetchImpl(`${parsed.origin}/${path}.json`,{
      ...rest, headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...headers}
    });
    if (!response.ok && response.status !== 412) throw new Error(`Firebase request failed (${response.status}). No response data has been logged.`);
    return response;
  };
}
async function runJob({rest, month = '2026-11', mode = 'check', now = Date.now()}) {
  const config = getConfig(month);
  if (!['check','initialize','generate'].includes(mode)) throw new Error('Unknown scheduling mode.');
  const response = await rest(config.privatePath,{headers:{'X-Firebase-ETag':'true'}});
  const existing = await response.json();
  const setting = await rest(config.settings);
  const settings = await setting.json();
  if (mode === 'check') return 'Authentication works. No data was changed.';
  if (mode === 'initialize') {
    if (settings !== null) return 'November settings already exist; left unchanged.';
    const created = await rest(config.settings,{method:'PUT',headers:{'if-match':'null_etag'},body:JSON.stringify({joinOpen:true})});
    return created.status === 412 ? 'Settings already initialized by another run.' : 'November joining is open. October data was not changed.';
  }
  if (now < config.cutoff) return 'Waiting until November 1 has ended in Pacific time. No data was changed.';
  if (existing?.status?.generatedAt) return 'The schedule is already saved; left unchanged.';
  if (now >= config.endAt) return 'November 2026 has ended. No schedule was created.';
  if (existing !== null) throw new Error('Unexpected existing private data. Stopped rather than replacing it.');
  const rosterResponse = await rest(config.roster);
  const roster = await rosterResponse.json();
  const schedule = makePrivateSchedule(roster,month,now);
  const etag = response.headers.get('etag');
  if (!etag) throw new Error('Firebase did not provide an ETag; stopped without writing.');
  const saved = await rest(config.privatePath,{method:'PUT',headers:{'if-match':etag},body:JSON.stringify(schedule)});
  return saved.status === 412 ? 'Another run saved the schedule first; left unchanged.' : 'Private November cheerleader dates saved. No participant names or dates have been logged.';
}
module.exports = {makePrivateSchedule,createRest,runJob};
if (require.main === module) {
  Promise.resolve().then(()=>runJob({rest:createRest({url:process.env.FIREBASE_DATABASE_URL,token:process.env.FIREBASE_ACCESS_TOKEN}),
    mode:process.env.SCHEDULE_MODE || 'check'})).then(message=>console.log(message)).catch(error=>{
      console.error(error.message);process.exitCode=1;
    });
}
