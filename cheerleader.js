const CHEER_SCHEDULE_PATH = 'cheerleaderScheduleOctober2026';
const CHEER_CLAIMS_PATH = 'cheerleaderClaimsOctober2026';
let cheerSchedule = {};
let cheerClaims = {};
let cheerReady = false;
let cheerSaving = false;

async function fetchCheerleader() {
  if (cheerSaving) return;
  try {
    const responses = await Promise.all([firebaseRequest(CHEER_SCHEDULE_PATH), firebaseRequest(CHEER_CLAIMS_PATH)]);
    if (responses.some(response => !response.ok)) throw Error('Cheerleader data unavailable');
    const [schedule, claims] = await Promise.all(responses.map(response => response.json()));
    cheerSchedule = schedule || {};
    cheerClaims = claims || {};
    cheerReady = true;
  } catch {
    cheerReady = false; // Keep last known totals; never allow writes from stale data.
  }
}

function cheerBonus(uid, dateKey) {
  if (!isChallengeDateKey(dateKey) || dateKey > actualTodayKey()) return 0;
  const claim = cheerClaims[dateKey];
  return cheerSchedule[dateKey]?.uid === uid && claim?.uid === uid && claim.status === 'claimed' ? 100 : 0;
}

function cheerStatus(dateKey) {
  const claim = cheerClaims[dateKey];
  return claim?.uid === cheerSchedule[dateKey]?.uid ? claim.status : 'assigned';
}

function canUpdateCheerleader(dateKey) {
  const assignment = cheerSchedule[dateKey];
  return cheerReady && !cheerSaving && !!ownedUid && isInChallengeMonth() && dateKey === actualTodayKey() &&
    assignment?.uid === ownedUid;
}

async function updateCheerleader(status) {
  const dateKey = actualTodayKey();
  if (!canUpdateCheerleader(dateKey) || !['accepted', 'passed', 'claimed'].includes(status)) return;
  const previous = cheerStatus(dateKey);
  if (status === 'claimed' && !['accepted', 'claimed'].includes(previous)) return;
  if (status === 'passed' && previous === 'claimed') return;
  const claim = { uid: ownedUid, status };
  cheerSaving = true;
  renderCheerleader();
  try {
    if (!TEST_MODE) {
      const response = await firebaseRequest(CHEER_CLAIMS_PATH + '/' + dateKey, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(claim)
      });
      if (!response.ok) throw Error('Could not save your cheerleader update. Please try again.');
    }
    if (TEST_MODE) {
      const data = JSON.parse(localStorage.getItem(TEST_STORAGE_KEY) || '{}');
      localStorage.setItem(TEST_STORAGE_KEY, JSON.stringify({ ...data, cheerSchedule, cheerClaims: { ...cheerClaims, [dateKey]: claim } }));
    }
    cheerClaims[dateKey] = claim;
    showToast(status === 'claimed' ? '100 cheerleader bonus points added. Thank you!' : 'Cheerleader choice saved.');
  } catch (error) {
    showToast(error.message || 'Save failed. Please try again.');
  } finally {
    cheerSaving = false;
    render();
  }
}

function renderCheerleader() {
  const card = document.getElementById('cheerleaderCard');
  const notice = document.getElementById('cheerleaderNotice');
  notice.classList.toggle('hidden', cheerReady || loadState !== 'ready');
  const key = actualTodayKey();
  const mine = !!ownedUid && isInChallengeMonth() && cheerSchedule[key]?.uid === ownedUid;
  card.classList.toggle('hidden', !mine);
  if (!mine) return;
  const status = cheerStatus(key);
  document.getElementById('cheerleaderStatus').textContent = status === 'claimed'
    ? 'Thank you! Your 100 bonus points are included in the team total.'
    : status === 'passed' ? 'You passed today. No problem - this role is optional.'
    : status === 'accepted' ? 'When you feel you have encouraged the group, claim your bonus below.'
    : 'You are invited to encourage the WhatsApp group today.';
  const accept = document.getElementById('cheerleaderAccept');
  const pass = document.getElementById('cheerleaderPass');
  accept.classList.toggle('hidden', ['accepted', 'claimed'].includes(status));
  pass.classList.toggle('hidden', ['passed', 'claimed'].includes(status));
  accept.disabled = pass.disabled = !canUpdateCheerleader(key);
  accept.onclick = () => updateCheerleader('accepted');
  pass.onclick = () => updateCheerleader('passed');
  document.getElementById('cheerleaderClaimLabel').classList.toggle('hidden', !['accepted','claimed'].includes(status));
  const checkbox = document.getElementById('cheerleaderClaim');
  checkbox.checked = status === 'claimed';
  checkbox.disabled = !canUpdateCheerleader(key);
  checkbox.onchange = () => updateCheerleader(checkbox.checked ? 'claimed' : 'accepted');
}
