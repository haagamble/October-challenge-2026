// Generate the verbose Pacific-date checks; retain October's existing schema.
const fs = require('node:fs');
const {getConfig,pacificMidnight} = require('./challenge-config.cjs');
const {pointsRule} = require('./club400.cjs');
function buildRules(source) {
  const result = structuredClone(source);
  const rules = result.rules;
  const config = getConfig('2026-11');
  delete rules.monthlyChallenges;
  rules.settingsNovember2026 = {'.read':'auth != null','.write':false};
  const active = Array.from({length:30},(_,index)=>{
    const day = index+1;
    return `($date === '2026-11-${String(day).padStart(2,'0')}' && now >= ${pacificMidnight(2026,10,day)} && now < ${pacificMidnight(2026,10,day+1)})`;
  }).join(' || ');
  const keyExpression = "newData.parent().child('name').val().toLowerCase().replace('%','%25').replace('.','%2E').replace('#','%23').replace('$','%24').replace('[','%5B').replace(']','%5D').replace('/','%2F')";
  const immutable = expression => `data.exists() ? newData.val() === data.val() : (${expression})`;
  const entries = JSON.parse(JSON.stringify(rules.groupChallengeOctober2026.$uid.entries).replaceAll('2026-10','2026-11').replaceAll('3[01]','30'));
  entries.$date['.write'] = `auth != null && auth.uid === $uid && root.child('${config.roster}').child($uid).exists() && (${active}) && (!data.child('rest').exists() || newData.child('rest').val() === true)`;
  entries.$date['.validate'] += " && (!data.child('rest').exists() || newData.child('rest').val() === true)";
  entries.$date.selected['.validate'] = "newData.hasChild('0') && (!newData.hasChild('2') || newData.hasChild('1')) && (!newData.hasChild('1') || newData.child('0').val() !== newData.child('1').val()) && (!newData.hasChild('2') || (newData.child('0').val() !== newData.child('2').val() && newData.child('1').val() !== newData.child('2').val()))";
  entries.$date.values.$activity['.validate'] += ' && newData.val() % 1 === 0';
  rules[config.roster] = {'.read':'auth != null', '$uid':{
    '.write':`auth != null && auth.uid === $uid && !data.exists() && newData.exists() && root.child('${config.settings}/joinOpen').val() === true && now < ${config.endAt} && (now >= ${config.startAt} || root.child('groupChallengeOctober2026').child($uid).exists())`,
    '.validate':"newData.hasChildren(['name','nameKey','joinedAt','returning','cheerOptIn']) && (data.exists() || !newData.hasChild('entries'))",
    name:{'.validate':immutable("newData.isString() && newData.val().length >= 1 && newData.val().length <= 30 && newData.val().matches(/^[^ ](.*[^ ])?$/) && (newData.parent().child('returning').val() !== true || newData.val() === root.child('groupChallengeOctober2026').child($uid).child('name').val())")},
    nameKey:{'.validate':immutable(`newData.isString() && newData.val() === ${keyExpression} && root.child('namesNovember2026').child(newData.val()).val() === $uid`)},
    returning:{'.validate':immutable("newData.isBoolean() && newData.val() === root.child('groupChallengeOctober2026').child($uid).exists()")},
    joinedAt:{'.validate':immutable('newData.isNumber() && newData.val() === now')},
    cheerOptIn:{'.validate':immutable('newData.isBoolean()')},
    entries,'$other':{'.validate':false}
  }};
  rules.namesNovember2026 = {'.read':'auth != null','$name':{
    '.write':`auth != null && newData.exists() && root.child('${config.settings}/joinOpen').val() === true && now < ${config.endAt} && (!data.exists() || data.val() === auth.uid)`,
    '.validate':'newData.isString() && newData.val() === auth.uid'
  }};
  const assignment = `root.child('${config.privatePath}/users').child($uid).child('dates').child($date)`;
  const bonusFromClaim = `newData.parent().parent().parent().parent().parent().child('${config.bonusPath}').child($date).val() === (newData.child('status').val() === 'claimed' ? 100 : 0)`;
  const claim = structuredClone(rules.cheerleaderClaimsOctober2026.$date);
  claim['.write'] = `auth != null && auth.uid === $uid && newData.exists() && ${assignment}.child('uid').val() === auth.uid && now >= ${assignment}.child('startAt').val() && now < ${assignment}.child('endAt').val()`;
  claim['.validate'] = claim['.validate'].replaceAll('2026-10','2026-11').replaceAll('3[01]','30') + ` && (${bonusFromClaim})`;
  rules[config.privatePath] = {'.read':false,'.write':false,
    status:{'.read':'auth != null'},
    users:{'$uid':{'.read':'auth != null && auth.uid === $uid',claims:{'$date':claim}}}
  };
  const ownAssignment = `root.child('${config.privatePath}/users').child(auth.uid).child('dates').child($date)`;
  const newClaim = `newData.parent().parent().child('${config.privatePath}/users').child(auth.uid).child('claims').child($date).child('status').val()`;
  rules[config.bonusPath] = {'.read':'auth != null','$date':{
    '.write':`auth != null && newData.exists() && ${ownAssignment}.child('uid').val() === auth.uid && now >= ${ownAssignment}.child('startAt').val() && now < ${ownAssignment}.child('endAt').val()`,
    '.validate':`newData.isNumber() && newData.val() === (${newClaim} === 'claimed' ? 100 : 0)`
  }};
  const clubRoot='newData.parent().parent().parent()';
  const entryRoot='newData.parent().parent().parent().parent()';
  const claimRoot='newData.parent().parent().parent().parent().parent()';
  const qualifies=root=>`${root}.child('${config.privatePath}/users').child($uid).child('claims').child($date).child('status').val() === 'claimed' && ${root}.child('${config.privatePath}/users').child($uid).child('dates').child($date).child('uid').val() === $uid && ${root}.child('${config.roster}').child($uid).child('entries').child($date).child('rest').val() !== true && (${pointsRule(root)}) >= 300`;
  const club=root=>`${root}.child('club400November2026').child($date).child($uid)`;
  rules.club400November2026={'.read':'auth != null','$date':{'$uid':{
    '.write':'auth != null && auth.uid === $uid',
    '.validate':`newData.isBoolean() && newData.val() === true && (${qualifies(clubRoot)})`
  }}};
  entries.$date['.write']+=` && (newData.exists() || !${club(entryRoot)}.exists())`;
  entries.$date['.validate']+=` && (!${club(entryRoot)}.exists() || (${qualifies(entryRoot)}))`;
  claim['.validate']+=` && (!${club(claimRoot)}.exists() || (${qualifies(claimRoot)}))`;
  return result;
}
module.exports = {buildRules};
if (require.main === module) {
  fs.writeFileSync('database.rules.json',JSON.stringify(buildRules(JSON.parse(fs.readFileSync('database.rules.json','utf8'))),null,2)+'\n');
}
