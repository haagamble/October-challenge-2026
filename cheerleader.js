let cheerSchedule = {};
let cheerClaims = {};
let cheerReady = false;
let cheerSaving = false;
let automaticCheerSchedule = null;

function eligibleCheerMembers(members) {
  return members.filter(member => {
    if (member.cheerOptIn === false) return false;
    if (!member.joinedAt || !Number.isFinite(Date.parse(member.joinedAt))) return false;
    const parts = getChallengeDateParts(new Date(member.joinedAt));
    const joinedDay = formatDateKey(dateFromChallengeParts(parts.year, parts.month, parts.day));
    return joinedDay <= challengeKey(1);
  }).sort((a, b) => a.uid.localeCompare(b.uid));
}

function buildCheerSchedule(members) {
  // Seeded shuffle gives concurrent local tabs the same balanced rotation.
  const rotation = [...members];
  let seed = 2166136261;
  for (const char of `${MONTH_KEY}:${rotation.map(member => member.uid).join(',')}`) {
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  }
  for (let i = rotation.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [rotation[i], rotation[j]] = [rotation[j], rotation[i]];
  }
  const schedule = {};
  if (!rotation.length) return schedule;
  for (let day = 2; day <= DAYS_IN_MONTH; day++) {
    const member = rotation[(day - 2) % rotation.length];
    schedule[challengeKey(day)] = { uid: member.uid, name: member.name };
  }
  return schedule;
}

async function ensureAutomaticCheerSchedule() {
  if (MONTH_KEY === '2026-10' || !TEST_MODE || pendingOwnedSaves || cheerSaving) return;
  const key = `${TEST_STORAGE_KEY}-cheer-schedule`;
  const generate = () => {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved) {
      automaticCheerSchedule = saved;
      cheerSchedule = saved.schedule;
      return;
    }
    if (actualTodayKey() <= challengeKey(1) || Object.keys(cheerSchedule).length) return;
    // Re-read membership inside the lock so another tab's joined members are included.
    const data = JSON.parse(localStorage.getItem(TEST_STORAGE_KEY) || '{}');
    const eligible = eligibleCheerMembers(data.participants || []);
    const result = { schedule: buildCheerSchedule(eligible), eligibleUids: eligible.map(member => member.uid),
      generatedAt: new Date(previewNow || Date.now()).toISOString(), cutoffDay: challengeKey(1) };
    localStorage.setItem(key, JSON.stringify(result));
    automaticCheerSchedule = result;
    cheerSchedule = result.schedule;
  };
  if (window.navigator?.locks) await window.navigator.locks.request(key, generate);
  else generate();
}

function renderAutomaticCheerSchedule() {
  const panel = document.getElementById('automaticCheerPanel');
  if (!panel) return;
  panel.classList.toggle('hidden', MONTH_KEY === '2026-10');
  if (MONTH_KEY === '2026-10') return;
  const status = document.getElementById('automaticCheerStatus');
  const member = participants.find(item => item.uid === ownedUid);
  const assignments = Object.entries(cheerSchedule).filter(([, assignment]) => assignment.uid === ownedUid).sort();
  const firstDay = actualTodayKey() === challengeKey(1);
  status.textContent = firstDay ? 'Everyone cheers today! Individual assignments begin tomorrow.'
    : actualTodayKey() < challengeKey(1) ? `Join ${MONTH_NAME} by the end of day 1, Pacific time, to enter the cheerleader rotation.`
    : automaticCheerSchedule ? !member ? 'Join this month to view your own cheerleader dates.'
      : assignments.length ? 'These are your assigned dates. You can accept or pass when your day arrives.'
      : member.cheerOptIn === false ? 'You opted out of the cheerleader rotation. You can still take part in the fitness challenge.'
      : 'You have no assigned cheerleader dates this month.'
    : 'The cheerleader schedule is being prepared.';
  const list = document.getElementById('automaticCheerList');
  list.replaceChildren();
  for (const [date] of assignments) {
    const row = document.createElement('p');
    row.textContent = `${MONTH_NAME} ${Number(date.slice(-2))}`;
    list.appendChild(row);
  }
}

async function fetchCheerleader() {
  if (cheerSaving) return;
  try {
    if (!TEST_MODE && MONTH_KEY !== '2026-10') {
      await fetchMonthlyPrivate();
      return;
    }
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
    if (!TEST_MODE && MONTH_KEY !== '2026-10') {
      const updates = {
        [`cheerleaderPrivateNovember2026/users/${ownedUid}/claims/${dateKey}`]:claim,
        [`cheerleaderBonusNovember2026/${dateKey}`]:status === 'claimed' ? 100 : 0,
        [`club400November2026/${dateKey}/${ownedUid}`]:status === 'claimed' && computePlayerTotalsForDate(ownedUid,dateKey)>=300 ? true : null
      };
      const response = await firebaseRequest('',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(updates)});
      if (!response.ok) throw new Error('Could not save your cheerleader update. Please refresh and try again.');
      await fetchMonthlyPrivate();
      showToast(status === 'claimed' ? '100 cheerleader bonus points added. Thank you!' : 'Cheerleader choice saved.');
      return;
    }
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
  renderAutomaticCheerSchedule();
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
