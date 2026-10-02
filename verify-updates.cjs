const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

async function main() {
  const events = {}, timers = [];
  let reloads = 0, requests = 0, published = 19, fail = false;
  const document = {
    visibilityState: 'visible', activeElement: null,
    querySelector: () => ({ content: '19' }),
    addEventListener: (name, fn) => { events[name] = fn; }
  };
  const navigator = { onLine: true };
  const context = vm.createContext({
    document, navigator, URL, URLSearchParams,
    localStorage: { getItem: () => null },
    window: {
      location: { search: '', protocol: 'https:', href: 'https://example.test/October-challenge-2026/?join=oct26', reload: () => reloads++ },
      addEventListener: (name, fn) => { events[name] = fn; },
      setInterval: (fn, ms) => timers.push({ fn, ms })
    },
    fetch: async (url, options) => {
      requests++;
      assert.equal(url.pathname, '/October-challenge-2026/index.html');
      assert.equal(options.cache, 'no-store');
      if (fail) throw new Error('Offline');
      return { ok: true, text: async () => `<meta name="app-version" content="${published}">` };
    }
  });
  const run = code => vm.runInContext(code, context);
  run(fs.readFileSync(path.join(__dirname, 'group-challenge.js'), 'utf8').replace(/init\(\);\s*$/, ''));
  run('let cheerSaving = false; els.joinName = { value: "" }; setupAutomaticUpdates();');
  await new Promise(resolve => setImmediate(resolve));
  const poll = timers.find(timer => timer.ms === 120000).fn;
  const retry = timers.find(timer => timer.ms === 2000).fn;
  assert.equal(reloads, 0, 'Current release does not reload');
  published = 18;
  await poll();
  assert.equal(reloads, 0, 'A stale cached release does not downgrade/reload');
  fail = true;
  await events.online();
  assert.equal(reloads, 0, 'Failed checks leave the app usable');
  fail = false;
  document.visibilityState = 'hidden';
  const before = requests;
  await poll();
  assert.equal(requests, before, 'Background app does not poll');
  document.visibilityState = 'visible';
  published = 20;
  run('unsavedActivityInputs.add("walking");');
  await events.visibilitychange();
  assert.equal(reloads, 0, 'Returning app detects update but protects drafts');
  run('unsavedActivityInputs.clear(); pendingOwnedSaves = 1;');
  retry();
  assert.equal(reloads, 0, 'Activity/rest save blocks reload');
  run('pendingOwnedSaves = 0; cheerSaving = true;');
  retry();
  assert.equal(reloads, 0, 'Cheerleader save blocks reload');
  run('cheerSaving = false; els.joinName.value = "Heather";');
  retry();
  assert.equal(reloads, 0, 'Joining blocks reload');
  run('els.joinName.value = "";');
  document.activeElement = { matches: () => true };
  retry();
  assert.equal(reloads, 0, 'Focused entry field blocks reload');
  document.activeElement = null;
  navigator.onLine = false;
  retry();
  assert.equal(reloads, 0, 'Deferred update waits for connectivity');
  navigator.onLine = true;
  retry(); retry();
  await events.pageshow();
  assert.equal(reloads, 1, 'Safe update reloads exactly once');

  // Exercise actual save handling: failed saves retain the reload blocker.
  run(`
    canLogToday = () => true; ownedUid = 'person';
    getCurrentDate = () => new Date(); formatDateKey = () => '2026-10-02';
    getPlayerEntry = () => ({ selected: ['walking'], values: {} });
    unsavedActivityInputs.add('walking'); setOwnedEntry = async () => false;
  `);
  await run('updateActivityValue("walking", "40")');
  assert.equal(run('unsavedActivityInputs.has("walking")'), true);
  run('setOwnedEntry = async () => true;');
  await run('updateActivityValue("walking", "40")');
  assert.equal(run('unsavedActivityInputs.has("walking")'), false);
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const version = html.match(/name="app-version" content="(\d+)"/)[1];
  assert.ok(html.includes(`group-challenge.js?v=oct2026-${version}`));
  assert.ok(fs.readFileSync(path.join(__dirname, 'service-worker.js'), 'utf8').includes('v' + version + '`'));
  console.log('Automatic update checks passed: return, polling, offline, drafts, saves, joining, and single reload.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
