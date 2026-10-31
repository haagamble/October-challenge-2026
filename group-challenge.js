const DB_URL = (window.GROUP_CHALLENGE_FIREBASE_CONFIG?.databaseURL || '').replace(/\/+$/, '');
const FIREBASE_API_KEY = window.GROUP_CHALLENGE_FIREBASE_CONFIG?.apiKey || '';
const JOIN_CODE = 'oct26';
const CHALLENGE_TIME_ZONE = 'America/Los_Angeles';
const QUERY_PARAMS = new URLSearchParams(window.location.search);
const LOCAL_PREVIEW = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) || window.location.protocol === 'file:';
const TEST_MODE = LOCAL_PREVIEW || QUERY_PARAMS.get('test') === '1';
let serverTimeOffset = 0;
// Simulated time is restricted to browser-only testing, never live scoring.
const previewNow = TEST_MODE ? QUERY_PARAMS.get('now') : null;
if (previewNow && (!/(Z|[+-]\d{2}:\d{2})$/.test(previewNow) || !Number.isFinite(Date.parse(previewNow)))) {
  throw new Error('Preview time must be an ISO timestamp with a timezone.');
}
const MONTH_CONFIGS = {
  '2026-10': { name: 'October', year: 2026, month: 9 },
  '2026-11': { name: 'November', year: 2026, month: 10 }
};
const currentParts = getChallengeDateParts();
const currentMonthKey = `${currentParts.year}-${String(currentParts.month).padStart(2, '0')}`;
const requestedMonth = QUERY_PARAMS.get('month');
if (requestedMonth && !MONTH_CONFIGS[requestedMonth]) throw new Error('Unsupported challenge month.');
const MONTH_KEY = requestedMonth || (MONTH_CONFIGS[currentMonthKey] ? currentMonthKey : currentMonthKey < '2026-10' ? '2026-10' : '2026-11');
const MONTH_CONFIG = MONTH_CONFIGS[MONTH_KEY];
const MONTH_NAME = MONTH_CONFIG.name;
const CHALLENGE_MONTH = MONTH_CONFIG.month;
const CHALLENGE_YEAR = MONTH_CONFIG.year;
const DAYS_IN_MONTH = new Date(Date.UTC(CHALLENGE_YEAR, CHALLENGE_MONTH + 1, 0)).getUTCDate();
const CHALLENGE_DATA_PATH = `groupChallenge${MONTH_NAME}${CHALLENGE_YEAR}`;
const JOIN_OPEN_PATH = `settings${MONTH_NAME}${CHALLENGE_YEAR}/joinOpen`;
const CHEER_SCHEDULE_PATH = `cheerleaderSchedule${MONTH_NAME}${CHALLENGE_YEAR}`;
const CHEER_CLAIMS_PATH = `cheerleaderClaims${MONTH_NAME}${CHALLENGE_YEAR}`;
const DAILY_PERSON_GOAL = 250;
const TEST_STORAGE_KEY = `${MONTH_NAME.toLowerCase()}-${CHALLENGE_YEAR}-group-challenge-test-data`;
const TEST_IDENTITY_STORAGE_KEY = `${MONTH_NAME.toLowerCase()}-${CHALLENGE_YEAR}-group-challenge-test-player`;
const AUTH_STORAGE_KEY = `october-2026-group-challenge-firebase-auth:${DB_URL}`;
const INSTALL_DISMISSED_KEY = 'october-2026-group-challenge-install-dismissed';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const ACTIVITY_DEFS = [
  { id: 'pushups', name: 'Push ups', unit: 'reps', pointsPerAmount: 2, amountPerPointUnit: 1, pointCapAmount: 50, maxPoints: 100, capLabel: '100 pt cap', notes: 'Enter reps - 2 pts each', detail: 'Wall pushups, knee pushups, and full pushups all count.' },
  { id: 'pullups', name: 'Pull ups', unit: 'reps', pointsPerAmount: 10, amountPerPointUnit: 1, pointCapAmount: 10, maxPoints: 100, capLabel: '100 pt cap', notes: 'Enter reps - 10 pts each' },
  { id: 'squats', name: 'Squats/Lunges', unit: 'reps', pointsPerAmount: 1, amountPerPointUnit: 1, pointCapAmount: 100, maxPoints: 100, capLabel: '100 pt cap', notes: 'Enter reps - 1 pt each' },
  { id: 'situps', name: 'Sit ups', unit: 'reps', pointsPerAmount: 1, amountPerPointUnit: 1, pointCapAmount: 100, maxPoints: 100, capLabel: '100 pt cap', notes: 'Enter reps - 1 pt each', detail: 'Full sit ups and crunches both count.' },
  { id: 'plank', name: 'Plank', unit: 'seconds', pointsPerAmount: 10, amountPerPointUnit: 30, pointCapAmount: 300, maxPoints: 100, capLabel: '100 pt cap', notes: 'Enter seconds - 10 pts per 30 sec' },
  { id: 'walking', name: 'Running/Walking', unit: 'minutes', pointsPerAmount: 5, amountPerPointUnit: 2, pointCapAmount: 40, maxPoints: 100, capLabel: '100 pt cap', notes: 'Enter minutes - 5 pts per 2 completed min' },
  { id: 'strength', name: 'Strength', unit: 'reps', pointsPerAmount: 1, amountPerPointUnit: 1, pointCapAmount: 100, maxPoints: 100, capLabel: '100 pt cap', notes: 'Enter reps - 1 pt each', detail: 'Weight-training exercises such as dumbbell curls, presses, rows, or kettlebell swings. Count each rep once, in one category only.' },
  { id: 'dancing', name: 'Dancing/Aerobics', unit: 'minutes', pointsPerAmount: 4, amountPerPointUnit: 1, pointCapAmount: 25, maxPoints: 100, capLabel: '100 pt cap', notes: 'Enter minutes - 4 pts per minute' },
  { id: 'stairs', name: 'Stairs', unit: 'stairs', pointsPerAmount: 1, amountPerPointUnit: 4, pointCapAmount: 400, maxPoints: 100, capLabel: '100 pt cap', notes: 'Enter stairs - 1 pt per 4 stairs' },
  { id: 'bird-dog', name: 'Bird dog', unit: 'reps', pointsPerAmount: 2, amountPerPointUnit: 1, pointCapAmount: 50, maxPoints: 100, capLabel: '100 pt cap', notes: 'Enter reps - 2 pts each', detail: 'One rep means a right-left pair.' },
  { id: 'other', name: 'Other', unit: 'points', pointsPerAmount: 1, amountPerPointUnit: 1, pointCapAmount: 100, maxPoints: 100, maxAmount: 100, capLabel: '100 pt daily cap', notes: 'Enter 0-100 points. See FAQ.' }
];

const DOUBLE_ACTIVITY_SCHEDULE = [
  'strength', 'walking', 'situps', 'stairs', 'pushups', 'plank', 'dancing', 'pullups', 'squats', 'bird-dog',
  'plank', 'strength', 'pushups', 'walking', 'bird-dog', 'situps', 'pullups', 'dancing', 'stairs', 'squats',
  'walking', 'squats', 'stairs', 'dancing', 'bird-dog', 'pullups', 'plank', 'strength', 'situps', 'pushups',
  'walking' // October 31 continues the rotation without repeating October 30.
].slice(0, DAYS_IN_MONTH); // November repeats the first 30 days, as agreed.

let participants = [];
let returningMembers = [];
let entriesByUid = {};
let ownedUid = TEST_MODE ? localStorage.getItem(TEST_IDENTITY_STORAGE_KEY) : null;
let currentUid = null;
let authSession = null;
let authPromise = null;
let hasInvite = false;
let joinOpen = false;
let loadState = 'loading';
let installPrompt = null;
let pendingOwnedSaves = 0;
let goalCelebratedThisVisit = false;
let teamCheerTotals = {};
const unsavedActivityInputs = new Set();

const els = {};

function navigateChallenge(month) {
  if (pendingOwnedSaves || cheerSaving || unsavedActivityInputs.size || els.joinName?.value?.trim()) {
    showToast('Finish saving your changes before switching months.');
    return false;
  }
  const url = new URL(window.location.href);
  if (month) url.searchParams.set('month', month);
  else url.searchParams.delete('month');
  window.location.assign(url.href);
  return true;
}

function pastChallengeKeys() {
  return Object.keys(MONTH_CONFIGS).filter(key => key < currentMonthKey).sort().reverse();
}

function setupChallengeNavigation() {
  // nav=1 previews the normal navigation while retaining isolated test storage.
  document.getElementById('testMonthPicker').classList.toggle('hidden', !TEST_MODE || QUERY_PARAMS.get('nav') === '1');
  const pastButton = document.getElementById('pastChallengesButton');
  const list = document.getElementById('pastChallengesList');
  const past = pastChallengeKeys();
  pastButton.classList.toggle('hidden', past.length === 0);
  pastButton.addEventListener('click', () => {
    const expanded = pastButton.getAttribute('aria-expanded') !== 'true';
    pastButton.setAttribute('aria-expanded', String(expanded));
    list.classList.toggle('hidden', !expanded);
  });
  for (const key of past) {
    const config = MONTH_CONFIGS[key];
    const button = document.createElement('button');
    button.className = 'btn';
    button.type = 'button';
    button.textContent = `${config.name} ${config.year}`;
    button.addEventListener('click', () => navigateChallenge(key));
    list.appendChild(button);
  }
  const back = document.getElementById('currentChallengeButton');
  back.classList.toggle('hidden', MONTH_KEY === currentMonthKey);
  back.addEventListener('click', () => navigateChallenge(null));
  const upcoming = MONTH_KEY === '2026-10' && currentMonthKey === '2026-10';
  document.getElementById('nextChallengeCard').classList.toggle('hidden', !upcoming);
  document.getElementById('nextChallengeButton').addEventListener('click', () => navigateChallenge('2026-11'));
}

function setupMonthView() {
  setupChallengeNavigation();
  document.getElementById('newCheerOptInLabel').classList.toggle('hidden', MONTH_KEY === '2026-10');
  document.getElementById('newCheerOptInNote').classList.toggle('hidden', MONTH_KEY === '2026-10');
  const title = `${MONTH_NAME} ${CHALLENGE_YEAR} Group Challenge`;
  document.title = title;
  document.querySelector('h1').textContent = title;
  const selector = document.getElementById('challengeMonth');
  selector.value = MONTH_KEY;
  selector.addEventListener('change', () => {
    if (!navigateChallenge(selector.value)) {
      selector.value = MONTH_KEY;
    }
  });
  document.getElementById('monthViewNotice').textContent = !isInChallengeMonth()
    ? (isBeforeChallenge() ? 'This month has not started. Returning participants can join early; logging opens on day 1.' : 'Completed month — read-only history.')
    : TEST_MODE ? 'Local preview: changes stay in this browser. No Firebase access.' : '';
  if (TEST_MODE) {
    document.getElementById('previewClock').textContent = `Pacific date: ${actualTodayKey()}${previewNow ? ' (simulated)' : ''}`;
  }
  // Keep explanatory month names and end dates consistent with the selected month.
  if (MONTH_KEY !== '2026-10') {
    document.getElementById('returningMemberHelp').classList.remove('hidden');
    for (const paragraph of document.querySelectorAll('#helpDialog p')) {
      paragraph.textContent = paragraph.textContent.replaceAll('October', MONTH_NAME)
        .replaceAll('29-31', `29-${DAYS_IN_MONTH}`).replaceAll(`${MONTH_NAME} 31`, `${MONTH_NAME} ${DAYS_IN_MONTH}`)
        .replaceAll('6,500', '6,250').replaceAll('6,750', '6,500');
    }
  }
}

function setupMonthRollover() {
  const loadedDate = actualTodayKey();
  const check = () => {
    if (document.visibilityState === 'hidden' || pendingOwnedSaves || cheerSaving || unsavedActivityInputs.size) return;
    if (actualTodayKey() !== loadedDate) window.location.reload();
  };
  document.addEventListener('visibilitychange', check);
  window.addEventListener('online', check);
  const refreshOnReturn = () => {
    if (document.visibilityState === 'hidden' || loadState !== 'ready' || pendingOwnedSaves || cheerSaving || unsavedActivityInputs.size) return;
    fetchAll().then(refreshAll).catch(() => {});
  };
  document.addEventListener('visibilitychange', refreshOnReturn);
  window.addEventListener('online', refreshOnReturn);
  window.setInterval(check, 30000);
}

function setupGoalCelebrationReplay() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      goalCelebratedThisVisit = false;
      return;
    }
    if (document.visibilityState === 'visible' && loadState === 'ready') renderGoalMeta();
  });
}

function init() {
  cacheElements();
  setupMonthView();
  setupGoalCelebrationReplay();
  setupMonthRollover();
  document.getElementById('appVersion').textContent = `Version ${document.querySelector('meta[name="app-version"]').content}`;
  checkInvite();
  bindEvents();
  setupInstallPrompt();
  registerServiceWorker();
  setupAutomaticUpdates();
  startApp();
}

function cacheElements() {
  els.joinBox = document.getElementById('joinBox');
  els.joinName = document.getElementById('joinName');
  els.joinButton = document.getElementById('joinButton');
  els.joinInstructions = document.getElementById('joinInstructions');
  els.nameStatus = document.getElementById('nameStatus');
  els.identityNote = document.getElementById('identityNote');
  els.nameGrid = document.getElementById('nameGrid');
  els.challengeContent = document.getElementById('challengeContent');
  els.testBanner = document.getElementById('testBanner');
  els.resetButton = document.getElementById('resetTestButton');
  els.teamToday = document.getElementById('teamToday');
  els.teamTodayRemaining = document.getElementById('teamTodayRemaining');
  els.teamMonth = document.getElementById('teamMonth');
  els.goalPace = document.getElementById('goalPace');
  els.goalText = document.getElementById('goalText');
  els.goalBar = document.getElementById('goalBar');
  els.goalMessage = document.getElementById('goalMessage');
  els.goalCelebration = document.getElementById('goalCelebration');
  els.goalCelebrationMessage = document.getElementById('goalCelebrationMessage');
  els.goalYesterday = document.getElementById('goalYesterday');
  els.goalTodayTarget = document.getElementById('goalTodayTarget');
  els.activityGrid = document.getElementById('activityGrid');
  els.todayHeadline = document.getElementById('todayHeadline');
  els.doubleDayBadge = document.getElementById('doubleDayBadge');
  els.personalMonth = document.getElementById('personalMonth');
  els.personalToday = document.getElementById('personalToday');
  els.personalAverage = document.getElementById('personalAverage');
  els.personalParticipation = document.getElementById('personalParticipation');
  els.personalActivities = document.getElementById('personalActivities');
  els.historyButton = document.getElementById('historyButton');
  els.historyDialog = document.getElementById('historyDialog');
  els.historyDays = document.getElementById('historyDays');
  els.closeHistoryButton = document.getElementById('closeHistoryButton');
  els.helpButton = document.getElementById('helpButton');
  els.teamStatsButton = document.getElementById('teamStatsButton');
  els.teamStatsDialog = document.getElementById('teamStatsDialog');
  els.teamStatsContent = document.getElementById('teamStatsContent');
  els.closeTeamStatsButton = document.getElementById('closeTeamStatsButton');
  els.helpDialog = document.getElementById('helpDialog');
  els.helpContent = document.getElementById('helpContent');
  els.closeHelpButton = document.getElementById('closeHelpButton');
  els.clubList = document.getElementById('clubList');
  els.participationList = document.getElementById('participationList');
  els.installCard = document.getElementById('installCard');
  els.installTitle = document.getElementById('installTitle');
  els.installMessage = document.getElementById('installMessage');
  els.installButton = document.getElementById('installButton');
  els.installDismiss = document.getElementById('installDismiss');
  els.toast = document.getElementById('toast');
}

function bindEvents() {
  els.teamStatsButton.addEventListener('click', () => {
    renderTeamStats();
    els.teamStatsDialog.showModal();
    els.teamStatsContent.scrollTop = 0;
  });
  els.closeTeamStatsButton.addEventListener('click', () => els.teamStatsDialog.close());
  els.helpButton.addEventListener('click', () => {
    els.helpDialog.showModal();
    els.helpContent.scrollTop = 0;
  });
  els.closeHelpButton.addEventListener('click', () => els.helpDialog.close());
  els.historyButton.addEventListener('click', () => {
    if (!ownedUid) return;
    renderDailyHistory();
    els.historyDialog.showModal();
    els.historyDays.scrollTop = 0;
  });
  els.closeHistoryButton.addEventListener('click', () => els.historyDialog.close());
  els.joinButton.addEventListener('click', joinChallenge);
  els.resetButton.addEventListener('click', resetTestData);
  els.joinName.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') joinChallenge();
  });
}

function isStandaloneApp() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function checkInvite() {
  hasInvite = TEST_MODE || QUERY_PARAMS.get('join') === JOIN_CODE || isStandaloneApp();
}

function escapeHtml(value) {
  const chars = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value).replace(/[&<>"']/g, (char) => chars[char]);
}

function storeAuthSession(data) {
  const expiresIn = Number(data.expiresIn || data.expires_in || 3600);
  authSession = {
    idToken: data.idToken || data.id_token,
    refreshToken: data.refreshToken || data.refresh_token,
    localId: data.localId || data.user_id,
    expiresAt: Date.now() + (expiresIn * 1000) - 60000
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authSession));
  return authSession;
}

function readAuthSession() {
  if (authSession) return authSession;
  try {
    authSession = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null');
  } catch {
    authSession = null;
  }
  return authSession;
}

async function createAnonymousAccount() {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true })
    }
  );
  if (!response.ok) throw new Error('Anonymous Firebase Authentication is not enabled.');
  return storeAuthSession(await response.json());
}

async function refreshAnonymousAccount(session) {
  const response = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: session.refreshToken
      })
    }
  );
  if (!response.ok) throw new Error('This device could not restore its Firebase identity.');
  return storeAuthSession(await response.json());
}

async function ensureAuthenticated(forceRefresh = false) {
  if (TEST_MODE) return null;
  if (authPromise) return authPromise;

  authPromise = (async () => {
    const session = readAuthSession();
    if (session && !forceRefresh && session.idToken && session.expiresAt > Date.now()) return session;
    if (session?.refreshToken) return refreshAnonymousAccount(session);
    return createAnonymousAccount();
  })();

  try {
    return await authPromise;
  } finally {
    authPromise = null;
  }
}

async function firebaseRequest(path, options = {}, hasRetried = false) {
  if (TEST_MODE) throw new Error('Firebase access is disabled in local/test mode.');
  const session = await ensureAuthenticated();
  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(
    `${DB_URL}/${path}.json${separator}auth=${encodeURIComponent(session.idToken)}`,
    {cache:'no-store',...options}
  );

  if (response.status === 401 && !hasRetried) {
    await ensureAuthenticated(true);
    return firebaseRequest(path, options, true);
  }
  return response;
}

function monthlyNameKey(name) {
  return name.trim().toLowerCase().replace(/%/g,'%25').replace(/[.#$\[\]\/]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

async function fetchMonthlyPrivate() {
  const uid = authSession.localId;
  const [own, status, bonuses] = await Promise.all([
    firebaseRequest(`cheerleaderPrivateNovember2026/users/${uid}`),
    firebaseRequest('cheerleaderPrivateNovember2026/status'),
    firebaseRequest('cheerleaderBonusNovember2026')
  ]);
  if (![own,status,bonuses].every(response => response.ok)) throw new Error('Cheerleader updates are unavailable.');
  const [mine, state, totals] = await Promise.all([own.json(),status.json(),bonuses.json()]);
  cheerSchedule = mine?.dates || {};
  cheerClaims = mine?.claims || {};
  automaticCheerSchedule = state?.generatedAt ? {private:true} : null;
  teamCheerTotals = totals || {};
  cheerReady = true;
}

async function fetchLiveMonth() {
  const uid = authSession.localId;
  const [roster, setting, previous] = await Promise.all([
    firebaseRequest(CHALLENGE_DATA_PATH), firebaseRequest(JOIN_OPEN_PATH),
    firebaseRequest(`groupChallengeOctober2026/${uid}/name`)
  ]);
  if (![roster,setting,previous].every(response => response.ok)) throw new Error('Could not load the monthly challenge.');
  const serverDate = Date.parse(roster.headers?.get('date') || '');
  if (Number.isFinite(serverDate)) serverTimeOffset = serverDate - Date.now();
  const [records, open, oldName] = await Promise.all([roster.json(),setting.json(),previous.json()]);
  participants = [];
  entriesByUid = {};
  for (const [id, record] of Object.entries(records || {})) {
    if (!record?.name) continue;
    participants.push({uid:id,name:record.name,returning:record.returning,joinedAt:record.joinedAt,cheerOptIn:record.cheerOptIn});
    entriesByUid[id] = sanitizeEntries(record.entries || {});
  }
  participants.sort((a,b) => a.name.localeCompare(b.name));
  returningMembers = oldName ? [{uid,name:oldName}] : [];
  ownedUid = participants.some(member => member.uid === uid) || oldName ? uid : null;
  joinOpen = open === true;
  await fetchMonthlyPrivate();
  loadState = 'ready';
}

async function joinLiveMonth(name, cheerOptIn) {
  const uid = authSession.localId;
  const existing = await firebaseRequest(`${CHALLENGE_DATA_PATH}/${uid}`);
  if (!existing.ok) throw new Error('Could not check your membership.');
  if (await existing.json()) {await fetchLiveMonth(); return;}
  const nameKey = monthlyNameKey(name);
  const reservation = await firebaseRequest(`namesNovember2026/${encodeURIComponent(nameKey)}`, {
    method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(uid)
  });
  if (!reservation.ok) throw new Error('That name is already reserved, or joining is closed. Contact the organizer if this is your previous identity.');
  const response = await firebaseRequest(`${CHALLENGE_DATA_PATH}/${uid}`, {
    method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,nameKey,
      returning:returningMembers.some(member => member.uid === uid),cheerOptIn,joinedAt:{'.sv':'timestamp'}})
  });
  if (!response.ok) throw new Error('Could not join this month. Please try again.');
  await fetchLiveMonth();
}

async function fetchAll(force = false) {
  if (!force && (pendingOwnedSaves || cheerSaving || unsavedActivityInputs.size)) return;
  if (TEST_MODE) {
    returningMembers = getPreviousTestMembers();
    const remembered = localStorage.getItem('group-challenge-test-device');
    if (!ownedUid && remembered !== '') {
      ownedUid = remembered || returningMembers.find(member => member.uid === localStorage.getItem('october-2026-group-challenge-test-player'))?.uid || null;
    }
    const data = JSON.parse(localStorage.getItem(TEST_STORAGE_KEY) || 'null');
    participants = data?.participants || [];
    entriesByUid = Object.fromEntries(Object.entries(data?.entriesByUid || {}).map(([uid, entries]) => [uid, sanitizeEntries(entries)]));
    cheerSchedule = data?.cheerSchedule || {};
    cheerClaims = data?.cheerClaims || {};
    cheerReady = true;
    joinOpen = true;
    loadState = 'ready';
    await ensureAutomaticCheerSchedule();
    return;
  }

  try {
    if (MONTH_KEY !== '2026-10') {
      await fetchLiveMonth();
      return;
    }
    const [challengeResponse, joinResponse] = await Promise.all([
      firebaseRequest(CHALLENGE_DATA_PATH),
      firebaseRequest(JOIN_OPEN_PATH)
    ]);
    if (!challengeResponse.ok) throw new Error(`Firebase returned ${challengeResponse.status}`);

    const data = await challengeResponse.json();
    joinOpen = joinResponse.ok && await joinResponse.json() === true;
    participants = [];
    entriesByUid = {};
    ownedUid = null;

    if (data && typeof data === 'object') {
      for (const [uid, record] of Object.entries(data)) {
        if (!record?.name) continue;
        participants.push({ uid, name: record.name });
        entriesByUid[uid] = sanitizeEntries(record.entries || {});
        if (uid === authSession.localId) ownedUid = uid;
      }
    }

    await fetchCheerleader();
    participants.sort((a, b) => a.name.localeCompare(b.name));
    loadState = 'ready';
  } catch (error) {
    console.error(error);
    cheerReady = false;
    loadState = 'error';
  }
}

function sanitizeEntries(entries) {
  const clean = {};
  if (!entries || typeof entries !== 'object') return clean;

  for (const [dateKey, entry] of Object.entries(entries)) {
    if (!isChallengeDateKey(dateKey) || !entry || typeof entry !== 'object') continue;
    // Preserve old running minutes by merging them into the combined category.
    const originalSelected = Array.isArray(entry.selected) ? [...new Set(entry.selected)] : [];
    const selected = [...new Set(originalSelected.map(id => id === 'running' ? 'walking' : id))]
      .filter(id => ACTIVITY_DEFS.some(activity => activity.id === id)).slice(0, 3);
    const values = {};
    selected.forEach((activityId) => {
      const activity = getActivity(activityId);
      const rawValue = activityId === 'walking'
        ? originalSelected.filter(id => id === 'walking' || id === 'running')
          .reduce((total, id) => total + normalizeActivityAmount(activity, entry.values?.[id]), 0)
        : Number(entry.values?.[activityId] || 0);
      values[activityId] = normalizeActivityAmount(activity, rawValue);
    });
    clean[dateKey] = entry.rest === true ? { rest: true, selected: [], values: {} } : { selected, values };
    if (!entry.rest && selected.includes('pullups') && ['full', 'modified'].includes(entry.pullupType)) {
      clean[dateKey].pullupType = entry.pullupType;
    }
  }

  return clean;
}

async function saveOwnedRecord(dateKey = actualTodayKey()) {
  if (!ownedUid) return;
  if (MONTH_KEY !== '2026-10' && !participants.some(member => member.uid === ownedUid)) throw new Error('Join this month before saving.');
  const earlyOptIn = MONTH_KEY !== '2026-10' && isBeforeChallenge() &&
    participants.some(member => member.uid === ownedUid && member.returning === true && member.startDate === challengeKey(1));
  if (!isInChallengeMonth() && !earlyOptIn) throw new Error('This month is read-only.');

  if (TEST_MODE) {
    localStorage.setItem(TEST_STORAGE_KEY, JSON.stringify({ participants, entriesByUid, cheerSchedule, cheerClaims }));
    return;
  }

  if (MONTH_KEY !== '2026-10') {
    const date = dateKey;
    const entry = entriesByUid[ownedUid]?.[date] || {selected:[],values:{}};
    const empty = !entry.rest && !entry.selected?.length;
    const response = await firebaseRequest(`${CHALLENGE_DATA_PATH}/${ownedUid}/entries/${date}`, {
      method:empty ? 'DELETE' : 'PUT',headers:{'Content-Type':'application/json'},
      ...(!empty ? {body:JSON.stringify(entry.rest ? {rest:true} : entry)} : {})
    });
    if (!response.ok) throw new Error('Could not save this entry. Only today’s Pacific-date entry is editable.');
    return;
  }

  const participant = participants.find((item) => item.uid === ownedUid);
  if (!participant) return;

  const response = await firebaseRequest(`${CHALLENGE_DATA_PATH}/${ownedUid}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: participant.name,
      entries: entriesByUid[ownedUid] || {}
    })
  });

  if (!response.ok) throw new Error(`Firebase rejected the write (${response.status}).`);
}

function getPreviousTestMembers() {
  const known = new Map();
  for (const [key, config] of Object.entries(MONTH_CONFIGS)) {
    if (key >= MONTH_KEY) continue;
    const data = JSON.parse(localStorage.getItem(`${config.name.toLowerCase()}-${config.year}-group-challenge-test-data`) || 'null');
    for (const member of data?.participants || []) known.set(member.uid, { uid: member.uid, name: member.name });
  }
  return [...known.values()];
}

function renderMonthJoin() {
  const box = document.getElementById('monthJoinBox');
  if (!box) return;
  const member = returningMembers.find(item => item.uid === ownedUid);
  const joined = participants.some(item => item.uid === ownedUid);
  box.classList.toggle('hidden', MONTH_KEY === '2026-10' || !member || joined);
  if (!member || joined) return;
  const start = isBeforeChallenge() ? challengeKey(1) : actualTodayKey();
  document.getElementById('monthJoinMessage').textContent =
    `Welcome back, ${member.name}. Joining starts your participation on ${start}, including your scoring days in the group goal. Weekly rest rules apply.`;
  const button = document.getElementById('monthJoinButton');
  button.textContent = `Join ${MONTH_NAME}`;
  button.disabled = pendingOwnedSaves > 0 || (!isBeforeChallenge() && !isInChallengeMonth());
  button.onclick = joinReturningMonth;
}

async function joinReturningMonth() {
  if (MONTH_KEY === '2026-10' || pendingOwnedSaves || (!isBeforeChallenge() && !isInChallengeMonth())) return;
  const member = returningMembers.find(item => item.uid === ownedUid);
  if (!member || participants.some(item => item.uid === ownedUid)) return;
  if (participants.some(item => item.name.trim().toLowerCase() === member.name.trim().toLowerCase())) {
    showToast(`The name ${member.name} is already used in ${MONTH_NAME}. Contact the organizer to resolve the duplicate identity.`);
    return;
  }
  if (!TEST_MODE) {
    if (!joinOpen) {showToast('Joining is currently closed.'); return;}
    pendingOwnedSaves++;
    render();
    try {
      await joinLiveMonth(member.name,document.getElementById('returningCheerOptIn').checked);
      showToast(`You joined ${MONTH_NAME}.`);
    } catch (error) {showToast(error.message);}
    finally {pendingOwnedSaves--; render();}
    return;
  }
  const record = { uid: member.uid, name: member.name, returning: true,
    cheerOptIn: document.getElementById('returningCheerOptIn')?.checked !== false,
    startDate: isBeforeChallenge() ? challengeKey(1) : actualTodayKey(),
    joinedAt: new Date(previewNow || Date.now()).toISOString() };
  participants.push(record);
  participants.sort((a, b) => a.name.localeCompare(b.name));
  entriesByUid[member.uid] = {};
  pendingOwnedSaves++;
  render();
  try {
    await saveOwnedRecord();
    localStorage.setItem(TEST_IDENTITY_STORAGE_KEY, member.uid);
    localStorage.setItem('group-challenge-test-device', member.uid);
    showToast(`You joined ${MONTH_NAME}.`);
  } catch (error) {
    participants = participants.filter(item => item.uid !== member.uid);
    delete entriesByUid[member.uid];
    showToast(error.message || 'Could not join. Please try again.');
  } finally {
    pendingOwnedSaves--;
    render();
  }
}

async function joinChallenge() {
  if (!isInChallengeMonth()) return;
  if (MONTH_KEY !== '2026-10' && returningMembers.some(member => member.uid === ownedUid)) return joinReturningMonth();
  const name = (els.joinName.value || '').trim();
  if (!name) {
    showToast('Please enter your first name.');
    return;
  }

  if (!TEST_MODE && ownedUid) {
    showToast('This device has already joined the challenge.');
    return;
  }
  if (!TEST_MODE && (!hasInvite || !joinOpen)) {
    showToast('Joining is currently closed.');
    return;
  }
  if (participants.some((item) => item.name.trim().toLowerCase() === name.toLowerCase())) {
    showToast('That name is already taken.');
    return;
  }

  if (!TEST_MODE && MONTH_KEY !== '2026-10') {
    if (pendingOwnedSaves) return;
    pendingOwnedSaves++;
    render();
    try {
      await joinLiveMonth(name,document.getElementById('newCheerOptIn').checked);
      els.joinName.value = '';
      showToast(`You joined ${MONTH_NAME}.`);
    } catch (error) {showToast(error.message);}
    finally {pendingOwnedSaves--; render();}
    return;
  }

  const uid = TEST_MODE ? `test-${Date.now()}` : authSession.localId;
  participants.push({ uid, name, ...(MONTH_KEY !== '2026-10' ? {
    joinedAt: new Date(previewNow || Date.now()).toISOString(),
    cheerOptIn: document.getElementById('newCheerOptIn')?.checked !== false
  } : {}) });
  participants.sort((a, b) => a.name.localeCompare(b.name));
  entriesByUid[uid] = {};
  ownedUid = uid;
  currentUid = uid;

  if (TEST_MODE) {
    localStorage.setItem(TEST_IDENTITY_STORAGE_KEY, uid);
    localStorage.setItem('group-challenge-test-device', uid);
  }

  try {
    await saveOwnedRecord();
  } catch (error) {
    participants = participants.filter((item) => item.uid !== uid);
    delete entriesByUid[uid];
    ownedUid = null;
    currentUid = null;
    showToast(error.message || 'Save failed. Check your connection.');
    render();
    return;
  }

  els.joinName.value = '';
  render();
  showToast(`${name} joined the challenge.`);
}

function resetTestData() {
  cheerSchedule = {};
  cheerClaims = {};
  cheerReady = true;
  if (!TEST_MODE) return;
  localStorage.removeItem(TEST_STORAGE_KEY);
  localStorage.removeItem(`${TEST_STORAGE_KEY}-cheer-schedule`);
  automaticCheerSchedule = null;
  localStorage.removeItem(TEST_IDENTITY_STORAGE_KEY);
  localStorage.setItem('group-challenge-test-device', '');
  goalCelebratedThisVisit = false;
  participants = [];
  entriesByUid = {};
  ownedUid = null;
  currentUid = null;
  render();
  showToast('Test data reset.');
}

function startPolling() {
  fetchAll().then(refreshAll).catch(() => {loadState = 'error'; render();});
  window.setInterval(async () => {
    if (document.visibilityState === 'hidden') return;
    await fetchAll();
    refreshAll();
  }, !TEST_MODE && MONTH_KEY !== '2026-10' ? 60000 : 15000);
}

async function startApp() {
  if (TEST_MODE) {
    els.testBanner.classList.remove('hidden');
    startPolling();
    return;
  }

  if (!FIREBASE_API_KEY || FIREBASE_API_KEY === 'REPLACE_WITH_FIREBASE_WEB_API_KEY' || !DB_URL) {
    loadState = 'config';
    render();
    return;
  }

  try {
    await ensureAuthenticated();
    startPolling();
  } catch (error) {
    console.error(error);
    loadState = 'error';
    render();
  }
}

function refreshAll() {
  if (ownedUid && !participants.some((item) => item.uid === ownedUid) && !returningMembers.some(item => item.uid === ownedUid)) {
    if (TEST_MODE) localStorage.removeItem(TEST_IDENTITY_STORAGE_KEY);
    ownedUid = null;
  }
  if (!currentUid && ownedUid) currentUid = ownedUid;
  if (currentUid && !participants.some((item) => item.uid === currentUid)) currentUid = ownedUid || null;
  render();
}

function render() {
  renderCheerleader();
  renderNames();
  renderGoalMeta();
  renderDailyActivities();
  renderPersonalSummary();
  renderClubList();
  renderParticipationList();
  els.challengeContent.classList.toggle('hidden', loadState !== 'ready' || participants.length === 0);
}

function testMemberLabel(participant) {
  const name = `${participant.name}${participant.uid === ownedUid ? ' (you)' : ''}`;
  if (MONTH_KEY === '2026-10') return name;
  return `${name} — ${participants.some(item => item.uid === participant.uid)
    ? `joined ${MONTH_NAME}` : `returning, not joined ${MONTH_NAME}`}`;
}

function renderNames() {
  els.nameGrid.replaceChildren();
  renderMonthJoin();

  const returning = MONTH_KEY !== '2026-10' && returningMembers.some(member => member.uid === ownedUid);
  const canJoin = !returning && isInChallengeMonth() && (TEST_MODE || (hasInvite && joinOpen && !ownedUid && loadState === 'ready'));
  els.joinBox.classList.toggle('hidden', !canJoin);

  // Keep the participant picker only for switching users in browser test mode.
  const testMembers = [...participants, ...returningMembers.filter(member => !participants.some(item => item.uid === member.uid))];
  (TEST_MODE ? testMembers : []).forEach((participant) => {
    const chip = document.createElement('button');
    chip.className = `member-chip ${participant.uid === currentUid ? 'active' : ''} ${participant.uid === ownedUid ? 'me' : ''}`;
    chip.textContent = testMemberLabel(participant);
    if (TEST_MODE) {
      chip.type = 'button';
      chip.addEventListener('click', () => selectParticipant(participant.uid));
    }
    els.nameGrid.appendChild(chip);
  });

  els.nameGrid.classList.toggle('hidden', !TEST_MODE || testMembers.length === 0);
  renderStatus();
  renderIdentityNote();
}

function renderStatus() {
  if (loadState === 'config') {
    els.nameStatus.classList.remove('hidden');
    els.nameStatus.innerHTML = '<strong>Firebase setup is incomplete.</strong>Add your Firebase Web API key and database URL in firebase-config.js.';
    return;
  }
  if (loadState === 'error') {
    els.nameStatus.classList.remove('hidden');
    els.nameStatus.innerHTML = '<strong>We could not load the challenge.</strong>Check your Firebase setup and refresh the page.';
    return;
  }
  if (loadState === 'loading') {
    els.nameStatus.classList.remove('hidden');
    els.nameStatus.innerHTML = '<strong>Loading challenge...</strong>';
    return;
  }
  if (participants.length === 0) {
    els.nameStatus.classList.remove('hidden');
    if (MONTH_KEY !== '2026-10' && returningMembers.some(member => member.uid === ownedUid)) {
      els.nameStatus.textContent = `You have not joined ${MONTH_NAME} yet. Use the Join ${MONTH_NAME} button above.`;
    } else if (TEST_MODE && !isInChallengeMonth()) {
      els.nameStatus.textContent = 'No test participants in this month. To add someone, open a preview date within this month.';
    } else if (TEST_MODE) {
      els.nameStatus.innerHTML = '<strong>Your test group is empty.</strong>Add a pretend participant above to get started.';
    } else if (hasInvite && joinOpen) {
      els.nameStatus.innerHTML = '<strong>Be the first to join.</strong> Enter your first name above to start the challenge.';
    } else if (hasInvite && !joinOpen) {
      els.nameStatus.innerHTML = '<strong>Joining is closed.</strong>Ask the challenge organizer if you still need access.';
    } else {
      els.nameStatus.innerHTML = '<strong>Ready to join?</strong> Open the invitation link you were sent.';
    }
    return;
  }

  els.nameStatus.classList.add('hidden');
}

function renderIdentityNote() {
  els.identityNote.replaceChildren();
  els.identityNote.classList.toggle('hidden', participants.length === 0 && returningMembers.length === 0);
  if (participants.length === 0 && returningMembers.length === 0) return;

  const message = document.createElement('span');
  if (!ownedUid) {
    message.textContent = TEST_MODE
      ? 'Choose a test user. This browser will remember your choice.'
      : 'Member names are shown for reference. Open your invite link to join from this device.';
  } else {
    const name = getParticipantName(ownedUid);
    message.append('This device is linked to ');
    const strong = document.createElement('strong');
    strong.textContent = name;
    message.append(strong, '.');
  }
  els.identityNote.appendChild(message);

  if (TEST_MODE && ownedUid) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn';
    button.textContent = 'Change user';
    button.addEventListener('click', forgetTestIdentity);
    els.identityNote.appendChild(button);
  }
}

function selectParticipant(uid) {
  if (!TEST_MODE) return;
  if (ownedUid !== uid) {
    const confirmed = window.confirm(`Use this device as ${getParticipantName(uid)}? You will be able to update this person's progress.`);
    if (!confirmed) return;
    ownedUid = uid;
    localStorage.setItem(TEST_IDENTITY_STORAGE_KEY, uid);
    localStorage.setItem('group-challenge-test-device', uid);
  }
  currentUid = uid;
  render();
}

function forgetTestIdentity() {
  if (!TEST_MODE) return;
  localStorage.removeItem(TEST_IDENTITY_STORAGE_KEY);
  localStorage.setItem('group-challenge-test-device', '');
  ownedUid = null;
  currentUid = null;
  render();
}

function renderGoalMeta() {
  const teamTotal = computeTeamTotalForDate(getCurrentDate());
  const monthTotal = computeMonthTotal();
  const goalTotal = computeTeamGoalThroughDay(DAYS_IN_MONTH);
  const progress = goalTotal === 0 ? 0 : Math.min((monthTotal / goalTotal) * 100, 100);
  const daysElapsed = isBeforeChallenge() ? 0 : getDaysElapsed();
  const parts = getChallengeDateParts();
  const actualToday = dateFromChallengeParts(parts.year, parts.month, parts.day);
  const completedDays = Math.max(0, Math.min(DAYS_IN_MONTH, Math.floor((actualToday - getChallengeStartDate()) / ONE_DAY_MS)));
  const todayKey = formatDateKey(actualToday);
  const yesterdayTotal = computeMonthTotalBeforeDate(todayKey);
  const yesterdayPaceTarget = computeTeamGoalThroughDay(completedDays);
  const yesterdayDelta = yesterdayTotal - yesterdayPaceTarget;
  const challengeEnded = completedDays >= DAYS_IN_MONTH;
  const goalReached = goalTotal > 0 && monthTotal >= goalTotal;
  const showCongratulations = goalReached && !isBeforeChallenge() && loadState === 'ready' && cheerReady;
  els.goalCelebration?.classList.toggle('hidden', !showCongratulations);
  if (els.goalCelebrationMessage) {
    const message = showCongratulations ? `We reached our ${MONTH_NAME} goal of ${formatNumber(goalTotal)} points! We did it together!` : '';
    if (els.goalCelebrationMessage.textContent !== message) els.goalCelebrationMessage.textContent = message;
  }
  const todayTeamGoal = Math.max(0, computeTeamGoalThroughDay(daysElapsed) - yesterdayPaceTarget);
  // Goal contributions are 250 per scoring day. Subtract completed-day
  // contributions to exclude past days and preserve each person's rest allowance.
  const remainingScoringDays = Math.max(0, (goalTotal - yesterdayPaceTarget) / DAILY_PERSON_GOAL);
  const averageNeededPerParticipant = remainingScoringDays > 0
    ? Math.ceil(Math.max(0, goalTotal - yesterdayTotal) / remainingScoringDays)
    : 0;
  const teamPointsRemainingToday = Math.max(0, todayTeamGoal - teamTotal);
  const showTodayTarget = !isBeforeChallenge() && !challengeEnded && goalTotal > 0;
  const showAverageMessage = !isBeforeChallenge() && !challengeEnded && goalTotal > 0 && !goalReached;

  els.teamToday.textContent = formatNumber(teamTotal);
  els.teamTodayRemaining.classList.toggle('hidden', !showTodayTarget);
  els.teamTodayRemaining.textContent = todayTeamGoal === 0
    ? '(No activity points required today)'
    : teamPointsRemainingToday > 0
    ? `(${formatNumber(teamPointsRemainingToday)} more points to reach today's target)`
    : '(Today\'s target reached)';
  els.teamMonth.textContent = formatNumber(monthTotal);
  els.goalPace.textContent = `${(Math.floor(progress * 10) / 10).toFixed(1)}%`;
  els.goalText.textContent = `${formatNumber(monthTotal)} / ${formatNumber(goalTotal)}`;
  els.goalBar.style.width = `${progress}%`;
  els.goalMessage.classList.toggle('average-needed', showAverageMessage);
  els.goalMessage.textContent = isBeforeChallenge()
    ? `The challenge starts ${formatDate(getChallengeStartDate())}.`
    : goalTotal === 0
    ? 'The team goal begins with first points or a Rest selection on the opening day of a week.'
    : goalReached
      ? `We did it! We reached our group goal of ${formatNumber(goalTotal)} points!`
      : challengeEnded
        ? `Challenge complete. We finished ${formatNumber(goalTotal - monthTotal)} points short of our group goal.`
    : `We need to average ${formatNumber(averageNeededPerParticipant)} points per person per remaining scoring day to win the month. This includes today and counts only people who have started. Rest days are excluded.`;
  if (goalReached && pendingOwnedSaves === 0 && cheerReady && !cheerSaving) celebrateGoalReached();
  els.goalTodayTarget.classList.toggle('hidden', !showTodayTarget);
  els.goalTodayTarget.textContent = showTodayTarget
    ? `Today's team goal: ${formatNumber(todayTeamGoal)}`
    : '';
  const showYesterday = completedDays > 0 && !challengeEnded && yesterdayPaceTarget > 0;
  els.goalYesterday.classList.toggle('hidden', !showYesterday);
  els.goalYesterday.classList.toggle('behind', showYesterday && yesterdayDelta < 0);
  els.goalYesterday.classList.toggle('on-pace', showYesterday && yesterdayDelta >= 0);
  els.goalYesterday.textContent = showYesterday ? getYesterdayPaceMessage(completedDays, yesterdayDelta) : '';
}

function computeTeamDailyStats() {
  if (isBeforeChallenge()) return [];
  const parts = getChallengeDateParts();
  const actualTodayKey = formatDateKey(dateFromChallengeParts(parts.year, parts.month, parts.day));
  const rows = [];
  let previousGoal = 0;
  for (let day = 1; day <= getDaysElapsed(); day++) {
    const date = dateFromChallengeParts(CHALLENGE_YEAR, CHALLENGE_MONTH + 1, day);
    const dateKey = formatDateKey(date);
    const cumulativeGoal = computeTeamGoalThroughDay(day);
    const goal = cumulativeGoal - previousGoal;
    previousGoal = cumulativeGoal;
    const eligible = goal / DAILY_PERSON_GOAL;
    const points = computeTeamTotalForDate(date);
    const logged = participants.filter(person => computePlayerTotalsForDate(person.uid, dateKey) > 0).length;
    const participating = participants.filter(person => {
      const firstDay = getParticipationStartDay(person.uid);
      return firstDay !== null && firstDay <= day;
    }).length;
    const rested = participants.filter(person => isRestDay(person.uid, dateKey)).length;
    const missed = Math.max(0, participating - logged - rested);
    const notStarted = participants.length - participating;
    rows.push({ date, points, goal, eligible, logged, rested, missed, participating, notStarted,
      average: eligible ? Math.round(points / eligible) : null,
      percent: goal ? Math.floor(points / goal * 100) : null,
      met: goal > 0 && points >= goal,
      isToday: dateKey === actualTodayKey });
  }
  return rows;
}

function renderTeamStats() {
  const rows = computeTeamDailyStats();
  const completed = rows.filter(row => !row.isToday && row.goal > 0);
  const wins = completed.filter(row => row.met).length;
  const best = completed.reduce((leader, row) => !leader || row.points > leader.points ? row : leader, null);
  els.teamStatsContent.innerHTML = `
    <div class="team-stats-summary">
      <strong>${wins ? `${wins} ${wins === 1 ? 'day' : 'days'} we met our daily goal!` : 'Every day is a new chance to meet our goal.'}</strong>
      <p>${completed.length ? `${wins} of ${completed.length} completed days with a team goal.` : 'Completed-day results will appear after the first day of participation.'}</p>
      ${best ? `<p>Best team total: <b>${formatNumber(best.points)} points</b> on ${formatDate(best.date)}.</p>` : ''}
    </div>
    <p class="team-stats-note">Each day stands on its own: we can meet that day's goal even while catching up for the month. Today's results are still in progress and are excluded from the summary above.</p>
    <p class="team-stats-note">The daily goal is 250 points per participant on scoring days. Each eligible full week includes one rest day with no goal. Additional missed days still count toward the goal. Total people participating includes people who logged activity points, rested, or missed logging. Joined, not started counts members of the current roster who had not begun by that date. Cheerleader bonuses alone do not count as logging activity points. Team totals can grow as more people start.</p>
    ${rows.length ? rows.slice().reverse().map(row => `
      <section class="team-stats-day ${row.met ? 'goal-met' : ''}">
        <h3>${formatDate(row.date)}${row.isToday ? ' · Today, in progress' : ''}</h3>
        <p class="team-stats-result">${row.met ? '&#10003; Daily goal met!' : row.goal === 0 ? 'No team goal yet' : row.isToday ? 'Working toward today\'s goal' : 'Daily goal not reached'}</p>
        <dl class="team-stats-values">
          <div><dt>Team points</dt><dd>${formatNumber(row.points)}</dd></div>
          <div><dt>Daily goal</dt><dd>${formatNumber(row.goal)}</dd></div>
          <div><dt>Daily goal achieved</dt><dd>${row.percent === null ? '—' : `${formatNumber(row.percent)}%`}</dd></div>
          <div><dt>Average per participant</dt><dd>${row.average === null ? '—' : `${formatNumber(row.average)} pts`}</dd></div>
          <div><dt>People who logged points</dt><dd>${row.logged}</dd></div>
          <div><dt>People who rested</dt><dd>${row.rested}</dd></div>
          <div><dt>${row.isToday ? 'Not logged yet' : 'People who missed logging'}</dt><dd>${row.missed}</dd></div>
          <div><dt>Total people participating</dt><dd>${row.participating}</dd></div>
          <div><dt>Joined, not started</dt><dd>${row.notStarted}</dd></div>
        </dl>
      </section>`).join('') : '<p>The challenge has not started yet.</p>'}`;
}

function renderRestSchedule() {
  const day = getCurrentDate().getUTCDate();
  const week = getRestWeek(ownedUid, day);
  const status = document.getElementById('restStatus');
  const button = document.getElementById('restButton');
  button.disabled = !canChooseRestToday();
  button.textContent = week.restDay === day ? 'Today is Rest' : 'Rest today';
  button.onclick = chooseRestToday;
  if (!isInChallengeMonth()) {
    status.textContent = isBeforeChallenge() ? `Rest choices open ${MONTH_NAME} 1, Pacific time.` : `${MONTH_NAME} challenge complete.`;
  } else if (day > 28) {
    status.textContent = `${MONTH_NAME} 29–${DAYS_IN_MONTH} is a partial week: no rest allowance.`;
  } else if (!ownedUid) {
    status.textContent = 'Join to log activities or choose Rest today.';
  } else if (week.restDay !== null) {
    status.textContent = week.restDay === day
      ? `${week.automatic ? 'Automatic rest day. ' : ''}Enjoy your break! Your weekly goal already includes it.`
      : `Your rest day was ${MONTH_NAME} ${week.restDay}. Additional missed days count toward your goal.`;
  } else if (week.eligible || canChooseRestToday()) {
    status.textContent = computeRawPlayerPoints(ownedUid, challengeKey(day)) > 0
      ? 'One rest day this week. Clear today’s activity values before choosing Rest.'
      : 'One required rest day this week. Choose Rest today, or your first completed zero-point day becomes Rest. After six scoring days, the seventh is Rest.';
  } else {
    status.textContent = participants.some(member => member.uid === ownedUid && member.returning)
      ? 'No rest allowance for a partial starting week. Your next rest allowance begins with the next full challenge week.'
      : `No rest allowance for a partial starting week. Eligibility begins with your first points, or Rest on ${MONTH_NAME} 1, 8, 15, or 22.`;
  }
  const end = Math.min(week.end, DAYS_IN_MONTH);
  document.getElementById('weekScheduleTitle').textContent = `Double points: ${MONTH_NAME} ${week.start}–${end}`;
  const list = document.getElementById('weekSchedule');
  list.replaceChildren();
  for (let date = week.start; date <= end; date++) {
    const item = document.createElement('li');
    const isToday = isInChallengeMonth() && date === day;
    if (isToday) item.setAttribute('aria-current', 'date');
    const activity = getActivity(DOUBLE_ACTIVITY_SCHEDULE[date - 1]);
    item.textContent = `${MONTH_NAME.slice(0,3)} ${date}${isToday ? ' · Today' : ''} — ${activity.name}${week.restDay === date ? ' · Rest' : ''}`;
    list.appendChild(item);
  }
}

function renderDailyActivities() {
  const today = getCurrentDate();
  const dateKey = formatDateKey(today);
  const currentEntry = getPlayerEntry(ownedUid, dateKey) || { selected: [], values: {} };
  const doubleId = getDoubleActivityId(today);
  const canLog = canLogToday();
  renderRestSchedule();

  els.todayHeadline.textContent = isBeforeChallenge()
    ? `Starts ${formatDate(today)}`
    : formatDate(today);
  document.getElementById('dailyHint').textContent = isBeforeChallenge()
    ? 'You can join now. Logging opens when the challenge starts on Pacific time.'
    : isRestDay(ownedUid, dateKey)
    ? 'Today is your rest day. No challenge points or goal contribution today.'
    : 'Choose 3 activities on scoring days. Aim for 250 points. Max 400. Days follow Pacific time.';
  els.doubleDayBadge.textContent = `2x today: ${getActivity(doubleId).name}`;
  els.doubleDayBadge.classList.remove('hidden');
  els.activityGrid.replaceChildren();

  ACTIVITY_DEFS.forEach((activity) => {
    const selected = currentEntry.selected?.includes(activity.id) || false;
    const isDouble = activity.id === doubleId;
    const card = document.createElement('div');
    card.className = `activity-card ${selected ? 'selected' : ''} ${isDouble ? 'double' : ''}`;

    const head = document.createElement('div');
    head.className = 'activity-head';
    const label = document.createElement('div');
    label.className = 'activity-name';
    label.textContent = activity.name;
    const badge = document.createElement('div');
    badge.className = 'activity-badge';
    badge.textContent = activity.capLabel;
    head.append(label, badge);

    const meta = document.createElement('div');
    meta.className = 'activity-meta';
    const pullupType = selected ? (currentEntry.pullupType || 'full') : getPreferredPullupType();
    meta.textContent = activity.id === 'pullups'
      ? (pullupType === 'modified' ? 'Enter reps - 2 pts each. 100 pt cap at 50 reps.' : 'Enter reps - 10 pts each. 100 pt cap at 10 reps.')
      : activity.notes;

    const doubleCallout = document.createElement('div');
    doubleCallout.className = 'activity-double-callout';
    doubleCallout.textContent = 'Double points today';

    const points = document.createElement('div');
    points.className = 'activity-points';
    const amount = selected ? getActivityValueForToday(activity.id, dateKey) : 0;
    const basePoints = computeActivityBasePoints(activity, amount, currentEntry);
    const earnedPoints = isDouble ? basePoints * 2 : basePoints;
    const atCap = selected && basePoints >= activity.maxPoints;
    points.classList.toggle('complete', atCap);
    const score = document.createElement('div');
    score.className = 'activity-score';
    score.textContent = `${earnedPoints} pts`;
    const logged = document.createElement('div');
    logged.className = 'activity-logged';
    logged.textContent = selected
      ? `${formatAmount(activity, amount)} logged`
      : `Enter ${activity.unit}`;
    points.append(score, logged);
    if (atCap) {
      const completion = document.createElement('div');
      completion.className = 'activity-completion';
      completion.textContent = '\u2713 Daily cap reached';
      points.appendChild(completion);
    }

    const actions = document.createElement('div');
    actions.className = 'activity-actions';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'activity-toggle';
    toggle.textContent = selected ? 'Selected' : 'Select';
    toggle.disabled = !canLog;
    toggle.addEventListener('click', () => toggleActivity(activity.id));

    const value = document.createElement('input');
    value.type = 'text';
    value.className = 'activity-value';
    value.inputMode = 'numeric';
    value.pattern = '[0-9]*';
    value.setAttribute('aria-label', `${activity.name} ${activity.unit}`);
    value.placeholder = activity.unit;
    value.value = selected ? String(getActivityValueForToday(activity.id, dateKey)) : '0';
    value.disabled = !canLog || !selected;
    value.addEventListener('focus', (event) => event.target.select());
    value.addEventListener('input', (event) => {
      event.target.value = event.target.value.replace(/\D/g, '');
      unsavedActivityInputs.add(activity.id);
    });
    value.addEventListener('change', (event) => updateActivityValue(activity.id, event.target.value));
    value.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') event.target.blur();
    });

    actions.append(toggle, value);
    card.append(head);
    if (isDouble) card.appendChild(doubleCallout);
    card.append(points, meta);
    if (activity.id === 'pullups') {
      const typeLabel = document.createElement('label');
      typeLabel.className = 'pullup-type';
      typeLabel.textContent = 'Pull-up type';
      const typeSelect = document.createElement('select');
      typeSelect.setAttribute('aria-label', 'Pull-up type');
      for (const [id, label] of [['full', 'Full - 10 pts per rep'], ['modified', 'Modified - 2 pts per rep']]) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = label;
        typeSelect.appendChild(option);
      }
      typeSelect.value = pullupType;
      typeSelect.disabled = !canLog || !selected;
      typeSelect.addEventListener('change', event => updatePullupType(event.target.value));
      typeLabel.appendChild(typeSelect);
      card.appendChild(typeLabel);
    }
    card.appendChild(actions);
    els.activityGrid.appendChild(card);
  });
}

function toggleActivity(activityId) {
  if (!canLogToday()) {
    showToast('Logging is unavailable today. Check your rest-day status.');
    return;
  }
  if (isBeforeChallenge()) {
    showToast(`The challenge starts ${formatDate(getChallengeStartDate())}.`);
    return;
  }

  if (!ownedUid) {
    showToast('Join the challenge before logging points.');
    return;
  }

  const dateKey = formatDateKey(getCurrentDate());
  const entry = getPlayerEntry(ownedUid, dateKey) || { selected: [], values: {} };
  const selectedIndex = entry.selected.indexOf(activityId);

  if (selectedIndex >= 0) {
    entry.selected.splice(selectedIndex, 1);
    delete entry.values[activityId];
    if (activityId === 'pullups') delete entry.pullupType;
  } else {
    if (entry.selected.length >= 3) {
      showToast('Choose 3 activities max for the day.');
      return;
    }
    entry.selected.push(activityId);
    entry.values[activityId] = 0;
    if (activityId === 'pullups') entry.pullupType = getPreferredPullupType();
  }

  setOwnedEntry(dateKey, entry);
}

async function updateActivityValue(activityId, value) {
  if (!canLogToday()) return;
  if (!ownedUid) return;
  const dateKey = formatDateKey(getCurrentDate());
  const entry = getPlayerEntry(ownedUid, dateKey) || { selected: [], values: {} };
  const activity = getActivity(activityId);
  if (!activity || !entry.selected.includes(activityId)) return;

  entry.values[activityId] = normalizeActivityAmount(activity, value);
  if (await setOwnedEntry(dateKey, entry)) unsavedActivityInputs.delete(activityId);
}

function pullupPreferenceKey() {
  return `october-2026-pullup-type:${TEST_MODE ? 'test' : DB_URL}:${ownedUid}`;
}

function getPreferredPullupType() {
  try { return localStorage.getItem(pullupPreferenceKey()) === 'modified' ? 'modified' : 'full'; }
  catch { return 'full'; }
}

async function updatePullupType(type) {
  if (!canLogToday() || !['full', 'modified'].includes(type)) return;
  const dateKey = formatDateKey(getCurrentDate());
  const entry = getPlayerEntry(ownedUid, dateKey);
  if (!entry?.selected?.includes('pullups')) return;
  const saved = await setOwnedEntry(dateKey, { ...entry, pullupType: type });
  if (saved) {
    try { localStorage.setItem(pullupPreferenceKey(), type); } catch { /* Preference is optional. */ }
  }
}

async function setOwnedEntry(dateKey, entry) {
  if (!ownedUid || dateKey !== actualTodayKey() || !isInChallengeMonth()) return;
  if (entry.rest ? !canChooseRestToday() : !canLogToday()) return;
  if (!entriesByUid[ownedUid]) entriesByUid[ownedUid] = {};
  if (!entry.rest && entry.selected.length === 0) {
    delete entriesByUid[ownedUid][dateKey];
  } else {
    entriesByUid[ownedUid][dateKey] = entry;
  }
  pendingOwnedSaves += 1;
  render();
  try {
    await saveOwnedRecord(dateKey);
    return true;
  } catch (error) {
    showToast(error.message || 'Save failed. Check your connection.');
    await fetchAll(true);
  } finally {
    pendingOwnedSaves = Math.max(0, pendingOwnedSaves - 1);
    render();
  }
}

function celebrateGoalReached() {
  if (document.visibilityState === 'hidden' || goalCelebratedThisVisit) return;
  goalCelebratedThisVisit = true;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const colors = ['#23674f', '#e77c50', '#e5b943', '#4f8da8', '#ca5360'];
  const burst = document.createElement('div');
  burst.className = 'confetti-burst';
  burst.setAttribute('aria-hidden', 'true');

  for (let index = 0; index < 48; index += 1) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.setProperty('--confetti-color', colors[index % colors.length]);
    piece.style.setProperty('--confetti-drift', `${Math.round(Math.random() * 180 - 90)}px`);
    piece.style.setProperty('--confetti-spin', `${Math.round(Math.random() * 900 + 360)}deg`);
    piece.style.animationDelay = `${Math.random() * 0.45}s`;
    burst.appendChild(piece);
  }

  document.body.appendChild(burst);
  window.setTimeout(() => burst.remove(), 3500);
}

function renderPersonalSummary() {
  els.historyButton.disabled = !ownedUid;
  if (!ownedUid) {
    els.personalMonth.textContent = '0';
    els.personalToday.textContent = '0';
    els.personalAverage.textContent = '0';
    els.personalParticipation.textContent = '0/0';
    renderPersonalActivities(null);
    return;
  }

  const todayKey = formatDateKey(getCurrentDate());
  els.personalMonth.textContent = formatNumber(computePlayerMonthTotal(ownedUid));
  els.personalToday.textContent = formatNumber(computePlayerTotalsForDate(ownedUid, todayKey) + cheerBonus(ownedUid, todayKey));
  els.personalAverage.textContent = formatNumber(computePlayerDailyAverage(ownedUid));
  const participationDays = isBeforeChallenge() ? 0 : getDaysElapsed();
  els.personalParticipation.textContent = `${participationDays ? computePlayerParticipationDays(ownedUid, todayKey) : 0}/${participationDays}`;
  renderPersonalActivities(getPlayerEntry(ownedUid, todayKey));
}

function renderPersonalActivities(entry) {
  els.personalActivities.replaceChildren();
  if (!entry?.selected?.length) {
    const empty = document.createElement('div');
    empty.className = 'personal-activity-empty';
    empty.textContent = isRestDay(ownedUid, formatDateKey(getCurrentDate()))
      ? 'Rest day - your goal already includes this break.' : 'No activities entered yet today.';
    els.personalActivities.appendChild(empty);
    return;
  }

  const dateKey = formatDateKey(getCurrentDate());
  const doubleActivityId = getDoubleActivityId(new Date(`${dateKey}T00:00:00Z`));
  entry.selected.forEach((activityId) => {
    const activity = getActivity(activityId);
    if (!activity) return;
    const amount = normalizeActivityAmount(activity, entry.values?.[activityId] || 0);
    const basePoints = computeActivityBasePoints(activity, amount, entry);
    const points = activityId === doubleActivityId ? basePoints * 2 : basePoints;
    const row = document.createElement('div');
    row.className = 'personal-activity-row';
    const label = document.createElement('span');
    label.textContent = activity.id === 'pullups' ? `Pull ups (${entry.pullupType === 'modified' ? 'Modified' : 'Full'})` : activity.name;
    const value = document.createElement('strong');
    value.textContent = `${formatAmount(activity, amount)} - ${points} pts`;
    row.append(label, value);
    els.personalActivities.appendChild(row);
  });
}

function renderDailyHistory() {
  els.historyDays.replaceChildren();
  const lastDay = isBeforeChallenge() ? 0 : getDaysElapsed();
  if (!lastDay) {
    els.historyDays.textContent = 'Your daily history will appear when the challenge starts.';
    return;
  }
  for (let day = lastDay; day >= 1; day -= 1) {
    const date = dateFromChallengeParts(CHALLENGE_YEAR, CHALLENGE_MONTH + 1, day);
    const dateKey = formatDateKey(date);
    const entry = getPlayerEntry(ownedUid, dateKey);
    const section = document.createElement('section');
    section.className = 'history-day';
    const heading = document.createElement('h3');
    heading.textContent = `${formatDate(date)} — ${formatNumber(computePlayerTotalsForDate(ownedUid, dateKey) + cheerBonus(ownedUid, dateKey))} pts`;
    section.appendChild(heading);
    if (cheerBonus(ownedUid, dateKey)) {
      const bonus = document.createElement('p'); bonus.textContent = 'Cheerleader bonus: +100 points'; section.appendChild(bonus);
    }
    if (isRestDay(ownedUid, dateKey) || !entry?.selected?.length) {
      const empty = document.createElement('p');
      empty.className = 'personal-activity-empty';
      empty.textContent = isRestDay(ownedUid, dateKey) ? 'Rest day - 0 points, no daily goal' : 'No activity logged';
      section.appendChild(empty);
    } else {
      const list = document.createElement('ul');
      list.className = 'history-activities';
      const doubleId = getDoubleActivityId(date);
      entry.selected.forEach((id) => {
        const activity = getActivity(id);
        if (!activity) return;
        const amount = normalizeActivityAmount(activity, entry.values?.[id] || 0);
        const points = computeActivityBasePoints(activity, amount, entry) * (id === doubleId ? 2 : 1);
        const row = document.createElement('li');
        const description = document.createElement('div');
        const name = document.createElement('span');
        name.textContent = `${activity.name}${id === 'pullups' ? ` (${entry.pullupType === 'modified' ? 'Modified' : 'Full'})` : ''}${id === doubleId ? ' · 2× points' : ''}`;
        const logged = document.createElement('div');
        logged.className = 'activity-logged';
        logged.textContent = `${formatAmount(activity, amount)} logged`;
        description.append(name, logged);
        const score = document.createElement('strong');
        score.textContent = `${formatNumber(points)} pts`;
        row.append(description, score);
        list.appendChild(row);
      });
      section.appendChild(list);
    }
    els.historyDays.appendChild(section);
  }
}

function renderClubList() {
  const previousDay = new Date(getCurrentDate().getTime() - ONE_DAY_MS);
  const previousKey = formatDateKey(previousDay);
  const names = participants
    .filter((participant) => computePlayerTotalsForDate(participant.uid, previousKey) >= 400)
    .map((participant) => participant.name);

  els.clubList.replaceChildren();
  if (!names.length) {
    const item = document.createElement('div');
    item.className = 'club-item';
    item.textContent = 'No one hit 400 yesterday.';
    els.clubList.appendChild(item);
    return;
  }

  names.forEach((name) => {
    const item = document.createElement('div');
    item.className = 'club-item';
    const span = document.createElement('span');
    span.textContent = name;
    const strong = document.createElement('strong');
    strong.textContent = '400 pts';
    item.append(span, strong);
    els.clubList.appendChild(item);
  });
}

function renderParticipationList() {
  const today = formatDateKey(getCurrentDate());
  els.participationList.replaceChildren();

  participants.forEach((participant) => {
    const entry = getPlayerEntry(participant.uid, today);
    const hasSaved = !!entry && entry.selected && entry.selected.length > 0;
    const item = document.createElement('div');
    item.className = 'participant-item';
    item.innerHTML = `<span class="participant-name">${escapeHtml(participant.name)}</span>`;
    if (hasSaved || isRestDay(participant.uid, today)) {
      const status = document.createElement('span');
      status.className = 'participant-status active';
      status.textContent = isRestDay(participant.uid, today) ? 'Rest day' : 'Participating';
      item.appendChild(status);
    }
    els.participationList.appendChild(item);
  });
}

function computeTeamTotalForDate(date) {
  const dateKey = formatDateKey(date);
  return participants.reduce((total, participant) => total + computePlayerTotalsForDate(participant.uid, dateKey) + cheerBonus(participant.uid, dateKey), 0)
    + privateTeamBonusAdjustment(key => key === dateKey);
}

function privateTeamBonusAdjustment(include = () => true) {
  if (TEST_MODE || MONTH_KEY === '2026-10') return 0;
  return Object.entries(teamCheerTotals).reduce((total,[key,value]) => total + (include(key) && key <= actualTodayKey() ? value : 0),0)
    - Object.keys(cheerSchedule).reduce((total,key) => total + (include(key) ? cheerBonus(ownedUid,key) : 0),0);
}

function computePlayerTotalsForDate(uid, dateKey) {
  if (isRestDay(uid, dateKey)) return 0;
  return computeRawPlayerPoints(uid, dateKey);
}

function computeRawPlayerPoints(uid, dateKey) {
  const entry = getPlayerEntry(uid, dateKey);
  if (entry?.rest || !entry?.selected) return 0;

  const doubleActivityId = getDoubleActivityId(new Date(`${dateKey}T00:00:00Z`));
  return entry.selected.reduce((total, activityId) => {
    const activity = getActivity(activityId);
    if (!activity) return total;
    const rawValue = normalizeActivityAmount(activity, Number(entry.values?.[activityId] || 0));
    const basePoints = computeActivityBasePoints(activity, rawValue, entry);
    return total + (activityId === doubleActivityId ? basePoints * 2 : basePoints);
  }, 0);
}

function normalizeActivityAmount(activity, value) {
  return Math.max(0, Math.min(Math.round(Number(value) || 0), activity.maxAmount ?? 9999));
}

function computeActivityBasePoints(activity, amount, entry = null) {
  if (activity.id === 'pullups' && entry?.pullupType === 'modified') return Math.min(amount * 2, activity.maxPoints);
  const pointUnits = Math.floor(amount / activity.amountPerPointUnit);
  return Math.min(pointUnits * activity.pointsPerAmount, activity.maxPoints);
}

function formatAmount(activity, amount) {
  return `${formatNumber(amount)} ${activity.unit}`;
}

function computePlayerMonthTotal(uid) {
  const entryMap = entriesByUid[uid] || {};
  return Object.keys(entryMap).reduce((total, dateKey) => total + computePlayerTotalsForDate(uid, dateKey), 0)
    + Object.keys(cheerSchedule).reduce((total, key) => total + cheerBonus(uid, key), 0);
}

function computePlayerDailyAverage(uid) {
  const entryMap = entriesByUid[uid] || {};
  const loggedDates = Object.keys(entryMap).filter((dateKey) => {
    const entry = entryMap[dateKey];
    return entry?.selected?.length > 0 && !isRestDay(uid, dateKey);
  });
  if (!loggedDates.length) return 0;

  const total = loggedDates.reduce((sum, dateKey) => sum + computePlayerTotalsForDate(uid, dateKey), 0);
  return Math.round(total / loggedDates.length);
}

function computePlayerParticipationDays(uid, todayKey) {
  let days = 0;
  for (let day = 1; day <= DAYS_IN_MONTH; day++) {
    const key = challengeKey(day);
    if (key > todayKey) break;
    if (isRestDay(uid, key) || computePlayerTotalsForDate(uid, key) > 0) days++;
  }
  return days;
}

// Rest is derived from saved entries and the shared Pacific date. Automatic rest
// never writes another participant's record. Unused allowances reserve week-end
// in goal calculations so each eligible full week always costs six scoring days.
function challengeKey(day) {
  return formatDateKey(dateFromChallengeParts(CHALLENGE_YEAR, CHALLENGE_MONTH + 1, day));
}

function actualTodayKey() {
  const parts = getChallengeDateParts();
  return formatDateKey(dateFromChallengeParts(parts.year, parts.month, parts.day));
}

function getParticipationStartDay(uid) {
  const today = actualTodayKey();
  const member = participants.find(item => item.uid === uid);
  if (MONTH_KEY !== '2026-10' && member?.returning === true && isChallengeDateKey(member.startDate)) {
    return Number(member.startDate.slice(-2));
  }
  if (MONTH_KEY !== '2026-10' && member?.returning === true && Number.isFinite(member.joinedAt)) {
    const joined = getChallengeDateParts(new Date(member.joinedAt));
    const key = formatDateKey(dateFromChallengeParts(joined.year,joined.month,joined.day));
    return key < challengeKey(1) ? 1 : Number(key.slice(-2));
  }
  const first = Object.keys(entriesByUid[uid] || {}).sort().find(key => {
    if (!isChallengeDateKey(key) || key > today) return false;
    const day = Number(key.slice(-2));
    return computeRawPlayerPoints(uid, key) > 0 ||
      ([1, 8, 15, 22].includes(day) && getPlayerEntry(uid, key)?.rest === true);
  });
  return first ? Number(first.slice(-2)) : null;
}

function getRestWeek(uid, day) {
  const start = Math.floor((day - 1) / 7) * 7 + 1;
  const end = start + 6;
  const first = getParticipationStartDay(uid);
  const eligible = day >= 1 && day <= 28 && first !== null && first <= start;
  let restDay = null;
  let automatic = false;
  if (eligible) {
    const today = actualTodayKey();
    for (let candidate = start; candidate <= end; candidate++) {
      const key = challengeKey(candidate);
      if (key > today) break;
      const explicit = getPlayerEntry(uid, key)?.rest === true;
      if (explicit || (key < today && computeRawPlayerPoints(uid, key) === 0) || candidate === end) {
        restDay = candidate;
        automatic = !explicit;
        break;
      }
    }
  }
  return { start, end, eligible, restDay, automatic };
}

function isRestDay(uid, dateKey) {
  if (!uid || !isChallengeDateKey(dateKey)) return false;
  const day = Number(dateKey.slice(-2));
  return getRestWeek(uid, day).restDay === day;
}

function canChooseRestToday() {
  if (!ownedUid || !isInChallengeMonth() || pendingOwnedSaves) return false;
  if (MONTH_KEY !== '2026-10' && !participants.some(member => member.uid === ownedUid)) return false;
  const day = getCurrentDate().getUTCDate();
  const week = getRestWeek(ownedUid, day);
  const canStart = getParticipationStartDay(ownedUid) === null && [1, 8, 15, 22].includes(day);
  return (week.eligible || canStart) && week.restDay === null &&
    computeRawPlayerPoints(ownedUid, challengeKey(day)) === 0;
}

function chooseRestToday() {
  if (!canChooseRestToday()) return;
  setOwnedEntry(formatDateKey(getCurrentDate()), { rest: true, selected: [], values: {} });
}

function computeTeamGoalThroughDay(lastDay) {
  if (isBeforeChallenge()) return 0;
  return participants.reduce((total, participant) => {
    const first = getParticipationStartDay(participant.uid);
    if (first === null) return total;
    const last = Math.min(lastDay, DAYS_IN_MONTH);
    let scoringDays = Math.max(0, last - first + 1);
    for (const start of [1, 8, 15, 22]) {
      const week = getRestWeek(participant.uid, start);
      if (week.eligible && (week.restDay ?? week.end) <= last) scoringDays--;
    }
    return total + scoringDays * DAILY_PERSON_GOAL;
  }, 0);
}

function computeMonthTotal() {
  return participants.reduce((total, participant) => total + computePlayerMonthTotal(participant.uid), 0) + privateTeamBonusAdjustment();
}

function computeMonthTotalBeforeDate(dateKeyLimit) {
  return participants.reduce((total, participant) => {
    const entryMap = entriesByUid[participant.uid] || {};
    return total + [...new Set([...Object.keys(entryMap), ...Object.keys(cheerSchedule)])].reduce((sum, dateKey) => {
      if (!isChallengeDateKey(dateKey) || dateKey >= dateKeyLimit) return sum;
      return sum + computePlayerTotalsForDate(participant.uid, dateKey) + cheerBonus(participant.uid, dateKey);
    }, 0);
  }, 0) + privateTeamBonusAdjustment(key => key < dateKeyLimit);
}

function getYesterdayPaceMessage(completedDays, delta) {
  if (isBeforeChallenge() || completedDays <= 0) return '';
  if (delta === 0) return 'On pace yesterday — right on target!';
  if (delta > 0) return `Ahead of pace yesterday by ${formatNumber(delta)} points!`;
  return `Behind pace yesterday by ${formatNumber(Math.abs(delta))} points.`;
}

function getPlayerEntry(uid, dateKey) {
  if (!uid) return null;
  return entriesByUid[uid]?.[dateKey] || null;
}

function getActivityValueForToday(activityId, dateKey) {
  return getPlayerEntry(ownedUid, dateKey)?.values?.[activityId] ?? 0;
}

function getActivity(activityId) {
  return ACTIVITY_DEFS.find((activity) => activity.id === activityId);
}

function getParticipantName(uid) {
  return participants.find((participant) => participant.uid === uid)?.name || returningMembers.find(member => member.uid === uid)?.name || 'Challenge member';
}

function getCurrentDate() {
  const parts = getChallengeDateParts();
  const challengeMonth = CHALLENGE_MONTH + 1;
  if (parts.year < CHALLENGE_YEAR || (parts.year === CHALLENGE_YEAR && parts.month < challengeMonth)) {
    return dateFromChallengeParts(CHALLENGE_YEAR, challengeMonth, 1);
  }
  if (parts.year > CHALLENGE_YEAR || (parts.year === CHALLENGE_YEAR && parts.month > challengeMonth)) {
    return dateFromChallengeParts(CHALLENGE_YEAR, challengeMonth, DAYS_IN_MONTH);
  }
  return dateFromChallengeParts(CHALLENGE_YEAR, challengeMonth, Math.min(parts.day, DAYS_IN_MONTH));
}

function getChallengeStartDate() {
  return dateFromChallengeParts(CHALLENGE_YEAR, CHALLENGE_MONTH + 1, 1);
}

function isBeforeChallenge() {
  const parts = getChallengeDateParts();
  const challengeMonth = CHALLENGE_MONTH + 1;
  return parts.year < CHALLENGE_YEAR || (parts.year === CHALLENGE_YEAR && parts.month < challengeMonth);
}

function isInChallengeMonth() {
  const parts = getChallengeDateParts();
  return parts.year === CHALLENGE_YEAR && parts.month === CHALLENGE_MONTH + 1;
}

function canLogToday() {
  if (MONTH_KEY !== '2026-10' && !participants.some(member => member.uid === ownedUid)) return false;
  return !!ownedUid && isInChallengeMonth() && !pendingOwnedSaves &&
    !isRestDay(ownedUid, formatDateKey(getCurrentDate()));
}

function getDaysElapsed() {
  const parts = getChallengeDateParts();
  const challengeMonth = CHALLENGE_MONTH + 1;
  if (parts.year < CHALLENGE_YEAR || (parts.year === CHALLENGE_YEAR && parts.month < challengeMonth)) return 1;
  if (parts.year > CHALLENGE_YEAR || (parts.year === CHALLENGE_YEAR && parts.month > challengeMonth)) return DAYS_IN_MONTH;
  return Math.max(1, Math.min(parts.day, DAYS_IN_MONTH));
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(date);
}

function formatDateKey(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isChallengeDateKey(dateKey) {
  return typeof dateKey === 'string' && dateKey.startsWith(`${MONTH_KEY}-`) &&
    /^\d{4}-\d{2}-\d{2}$/.test(dateKey) && Number(dateKey.slice(-2)) >= 1 && Number(dateKey.slice(-2)) <= DAYS_IN_MONTH;
}

function getDoubleActivityId(date) {
  const dayNumber = date.getUTCDate();
  return DOUBLE_ACTIVITY_SCHEDULE[dayNumber - 1] || ACTIVITY_DEFS[(dayNumber - 1) % ACTIVITY_DEFS.length].id;
}

function getChallengeDateParts(date = new Date(previewNow || (Date.now() + serverTimeOffset))) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: CHALLENGE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day)
  };
}

function dateFromChallengeParts(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  window.clearTimeout(showToast.timerId);
  showToast.timerId = window.setTimeout(() => {
    els.toast.classList.remove('show');
  }, 2200);
}

function setupInstallPrompt() {
  const isIos = isIosDevice();
  const isStandalone = isStandaloneApp();

  els.installTitle.textContent = 'Add this app to your phone';

  if (isIos && !isStandalone && hasInvite) {
    els.joinInstructions.textContent = 'For the smoothest setup, add this page to your Home Screen first, then open the app and join there.';
    els.installCard.classList.remove('hidden');
  }

  if (isStandalone || localStorage.getItem(INSTALL_DISMISSED_KEY) === 'yes') return;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    els.installTitle.textContent = 'Add this app to your device';
    els.installButton.classList.remove('hidden');
    els.installCard.classList.remove('hidden');
  });

  els.installButton.addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    els.installCard.classList.add('hidden');
  });

  els.installDismiss.addEventListener('click', () => {
    localStorage.setItem(INSTALL_DISMISSED_KEY, 'yes');
    els.installCard.classList.add('hidden');
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    els.installCard.classList.add('hidden');
  });
}

function setupAutomaticUpdates() {
  const version = Number(document.querySelector('meta[name="app-version"]')?.content);
  if (TEST_MODE || !version || window.location.protocol === 'file:') return;
  let updateReady = false;
  let checking = false;
  let reloading = false;

  const reloadWhenSafe = () => {
    if (!updateReady || reloading || document.visibilityState !== 'visible' || navigator.onLine === false) return;
    if (pendingOwnedSaves || cheerSaving || unsavedActivityInputs.size || els.joinName?.value?.trim()) return;
    if (document.activeElement?.matches('input, select, textarea, [contenteditable="true"]')) return;
    reloading = true;
    window.location.reload();
  };

  const checkForUpdate = async () => {
    if (checking || reloading || document.visibilityState !== 'visible' || navigator.onLine === false) return;
    checking = true;
    try {
      // Read the published release number, independently of service-worker activation.
      // This also works when a returning app already has a newer worker controlling it.
      const response = await fetch(new URL('./index.html', window.location.href), { cache: 'no-store' });
      if (response.ok) {
        const html = await response.text();
        const published = html.match(/<meta\s+name="app-version"\s+content="(\d+)"\s*\/?\s*>/i);
        if (published && Number(published[1]) > version) updateReady = true;
      }
    } catch {
      // Offline or a failed deployment check: keep the current app usable.
    } finally {
      checking = false;
    }
    reloadWhenSafe();
  };

  document.addEventListener('visibilitychange', checkForUpdate);
  window.addEventListener('online', checkForUpdate);
  window.addEventListener('pageshow', checkForUpdate);
  window.setInterval(checkForUpdate, 2 * 60 * 1000);
  // A deferred update can proceed shortly after the participant finishes saving.
  window.setInterval(reloadWhenSafe, 2000);
  checkForUpdate();
}

function registerServiceWorker() {
  const isLocalHost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  if ('serviceWorker' in navigator && (TEST_MODE || isLocalHost)) {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations
        .filter((registration) => registration.scope === new URL('./', window.location.href).href)
        .map((registration) => registration.unregister())))
      .catch(() => {});
    return;
  }

  if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('./service-worker.js', {
          updateViaCache: 'none'
        });
        await registration.update();
      } catch {
        // The service worker is optional for local test usage.
      }
    });
  }
}

init();
