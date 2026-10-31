const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('cheerleader.js', 'utf8') + '\n' + fs.readFileSync('group-challenge.js', 'utf8').replace(/init\(\);\s*$/, '');
function preview(query) {
  const nodes = new Map();
  function element() {
    const classes = new Set();
    return {children: [], events: {}, attrs: {'aria-expanded':'false'},
      classList: {toggle(name, hidden){hidden ? classes.add(name) : classes.delete(name);}, contains(name){return classes.has(name);}},
      addEventListener(name, fn){this.events[name] = fn;},
      appendChild(child){this.children.push(child);}, getAttribute(name){return this.attrs[name];}, setAttribute(name,value){this.attrs[name]=value;}};
  }
  const document = {getElementById(id){if(!nodes.has(id)) nodes.set(id,element()); return nodes.get(id);}, createElement:element};
  let destination;
  const context = vm.createContext({URL, URLSearchParams, Intl, Date, document,
    window:{location:{hostname:'localhost',protocol:'http:',search:query,href:`http://localhost:4173/${query}`,assign(url){destination=url;}}},
    localStorage:{getItem:()=>null}});
  vm.runInContext(source,context);
  vm.runInContext('showToast = () => {}; setupChallengeNavigation();',context);
  return {nodes, run:code=>vm.runInContext(code,context), destination:()=>destination};
}
const october = preview('?now=2026-10-31T19:00:00Z&nav=1');
assert.equal(october.nodes.get('testMonthPicker').classList.contains('hidden'),true);
assert.equal(october.nodes.get('pastChallengesButton').classList.contains('hidden'),true);
assert.equal(october.nodes.get('nextChallengeCard').classList.contains('hidden'),false);
october.nodes.get('nextChallengeButton').events.click();
assert.equal(new URL(october.destination()).searchParams.get('month'),'2026-11');
assert.equal(new URL(october.destination()).searchParams.get('now'),'2026-10-31T19:00:00Z');
const november = preview('?month=2026-10&now=2026-11-02T20:00:00Z');
assert.equal(november.nodes.get('testMonthPicker').classList.contains('hidden'),false);
assert.equal(november.nodes.get('pastChallengesList').children.length,1);
assert.equal(november.nodes.get('pastChallengesList').children[0].textContent,'October 2026');
assert.equal(november.nodes.get('currentChallengeButton').classList.contains('hidden'),false);
november.nodes.get('pastChallengesButton').events.click();
assert.equal(november.nodes.get('pastChallengesButton').getAttribute('aria-expanded'),'true');
november.nodes.get('currentChallengeButton').events.click();
assert.equal(new URL(november.destination()).searchParams.has('month'),false);
november.run('pendingOwnedSaves = 1;');
assert.equal(november.run("navigateChallenge('2026-11')"),false);
console.log('PASS: test-only dropdown, completed months only, early November link, current-month return, preserved preview date, and unsaved-change guard.');
