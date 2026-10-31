const TIME_ZONE = 'America/Los_Angeles';
function pacificMidnight(year, monthIndex, day) {
  const target = Date.UTC(year,monthIndex,day);
  let instant = target + 8*3600000;
  for (let i=0;i<3;i++) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant)).map(part=>[part.type,part.value]));
    const local = Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour));
    instant += target-local;
  }
  return instant;
}
function getConfig(month) {
  if (month !== '2026-11') throw new Error('Only November 2026 is configured.');
  return {month, days:30, startAt:pacificMidnight(2026,10,1), cutoff:pacificMidnight(2026,10,2), endAt:pacificMidnight(2026,11,1),
    roster:'groupChallengeNovember2026',settings:'settingsNovember2026',privatePath:'cheerleaderPrivateNovember2026',bonusPath:'cheerleaderBonusNovember2026'};
}
module.exports = {getConfig,pacificMidnight};
