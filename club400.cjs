const rotation=['strength','walking','situps','stairs','pushups','plank','dancing','pullups','squats','bird-dog','plank','strength','pushups','walking','bird-dog','situps','pullups','dancing','stairs','squats','walking','squats','stairs','dancing','bird-dog','pullups','plank','strength','situps','pushups'];
const rates={pushups:[2,1,50],pullups:[10,1,10],squats:[1,1,100],situps:[1,1,100],plank:[10,30,300],walking:[5,2,40],strength:[1,1,100],dancing:[4,1,25],stairs:[1,4,400],'bird-dog':[2,1,50],other:[1,1,100]};
function activityPoints(entry,date) {
  if(!entry||entry.rest)return 0;
  return (entry.selected||[]).reduce((total,id)=>{
    if(!rates[id])return total;
    const [rate,block]=id==='pullups'&&entry.pullupType==='modified'?[2,1]:rates[id];
    return total+Math.min(100,Math.floor((entry.values?.[id]||0)/block)*rate)*(rotation[Number(date.slice(-2))-1]===id?2:1);
  },0);
}
function pointsRule(root) {
  const entry=`${root}.child('groupChallengeNovember2026').child($uid).child('entries').child($date)`;
  return Object.entries(rates).map(([id,[rate,block,cap]])=>{
    const field=`${entry}.child('values/${id}')`,raw=`${field}.val()`;
    const selected=[0,1,2].map(i=>`${entry}.child('selected/${i}').val() === '${id}'`).join(' || ');
    const base=(rate,block,cap)=>`(${raw} >= ${cap} ? 100 : ((${raw} - (${raw} % ${block})) / ${block}) * ${rate})`;
    const score=id==='pullups'?`(${entry}.child('pullupType').val() === 'modified' ? ${base(2,1,50)} : ${base(rate,block,cap)})`:base(rate,block,cap);
    const dates=rotation.flatMap((value,i)=>value===id?[`$date === '2026-11-${String(i+1).padStart(2,'0')}'`]:[]);
    return `((${selected}) && ${field}.isNumber() ? ${score} * (${dates.length?dates.join(' || '):'false'} ? 2 : 1) : 0)`;
  }).join(' + ');
}
module.exports={activityPoints,pointsRule};
