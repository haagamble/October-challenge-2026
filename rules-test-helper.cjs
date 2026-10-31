// Rule-expression checks; verify-emulator.cjs also tests the actual rules engine.
const vm=require('node:vm');
const rules=JSON.parse(require('node:fs').readFileSync('database.rules.json','utf8')).rules;
const at=(tree,path)=>path.reduce((value,key)=>value?.[key],tree)??null;
function snapshot(tree,path=[]) {
  const value=at(tree,path);
  return {val:()=>value,exists:()=>value!==null,isString:()=>typeof value==='string',isNumber:()=>typeof value==='number',isBoolean:()=>typeof value==='boolean',
    child:key=>snapshot(tree,[...path,...key.split('/')]),parent:()=>snapshot(tree,path.slice(0,-1)),hasChild:key=>at(tree,[...path,...key.split('/')])!==null,
    hasChildren:keys=>keys?keys.every(key=>at(tree,[...path,...key.split('/')])!==null):!!value&&typeof value==='object'&&Object.keys(value).length>0};
}
function lineage(path) {
  const result=[{rule:rules,path:[],bindings:{}}];
  for(const key of path) {
    const prev=result.at(-1);
    const name=Object.hasOwn(prev.rule,key)?key:Object.keys(prev.rule).find(field=>field.startsWith('$'));
    if(!name)break;
    result.push({rule:prev.rule[name],path:[...prev.path,key],bindings:{...prev.bindings,...(name.startsWith('$')?{[name]:key}:{})}});
  }
  return result;
}
function evaluate(expression,location,before,after,uid,now) {
  if(typeof expression==='boolean')return expression;
  try{return !!vm.runInNewContext(expression.replaceAll('.matches(','.match(').replaceAll('.replace(','.replaceAll('),{
    ...location.bindings,auth:uid?{uid}:null,now,root:snapshot(before),data:snapshot(before,location.path),newData:snapshot(after,location.path)
  });}catch{return false;}
}
function canRead(tree,path,uid) {
  return lineage(path.split('/')).some(location=>Object.hasOwn(location.rule,'.read')&&evaluate(location.rule['.read'],location,tree,tree,uid,Date.now()));
}
function resolved(value,now) {
  if(Array.isArray(value))return value.map(item=>resolved(item,now));
  if(value&&typeof value==='object')return value['.sv']==='timestamp'?now:Object.fromEntries(Object.entries(value).map(([key,item])=>[key,resolved(item,now)]));
  return value;
}
function setAt(tree,path,value) {
  let parent=tree;
  for(const key of path.slice(0,-1))parent=parent[key]||={};
  if(value===null)delete parent[path.at(-1)];else parent[path.at(-1)]=value;
}
function attempt(tree,updates,uid,now) {
  const after=structuredClone(tree);
  for(const [path,value]of Object.entries(updates))setAt(after,path.split('/'),resolved(value,now));
  function validate(path) {
    if(!lineage(path).every(location=>!Object.hasOwn(location.rule,'.validate')||!snapshot(after,location.path).exists()||evaluate(location.rule['.validate'],location,tree,after,uid,now)))return false;
    const value=at(after,path);
    return !value||typeof value!=='object'||Object.keys(value).every(key=>validate([...path,key]));
  }
  const allowed=Object.keys(updates).every(key=>{
    const path=key.split('/');
    return lineage(path).some(location=>Object.hasOwn(location.rule,'.write')&&evaluate(location.rule['.write'],location,tree,after,uid,now))&&validate(path);
  });
  return {allowed,after};
}
module.exports={attempt,canRead,rules};
