# Group Fit

The 400 Club counts activity points plus a claimed cheerleader bonus. For example,
300 activity points plus a 100-point bonus qualifies; an unclaimed bonus does not.
November shares only a verified club-qualification flag, not private assignments
or Pass decisions. Entry edits and bonus undo remove qualification atomically.
See SETUP-NOVEMBER.md for the rules-first update and completed-day update steps.

## Monthly challenges and safe local testing

For account configuration and launch steps, see [SETUP-NOVEMBER.md](SETUP-NOVEMBER.md).

Normal navigation opens the current Pacific month and offers **Past challenges**
for completed months, newest first. History provides **Back to current challenge**.
The month dropdown is test-only. Add `&nav=1` to a dated local preview URL to hide
that dropdown and try normal navigation while still using isolated browser data.
October's screen offers a **Join November** link to the November opt-in screen
before November starts. Navigation protects unsaved input and retains preview time.

November uses the existing Firebase Spark project directly. GitHub Actions generates the private cheerleader schedule using temporary OIDC credentials; no Cloud Functions or billing upgrade is part of the implementation. Account-side OIDC setup and deployment are still to be performed by the owner. October paths and the existing authentication key are preserved. Rules close October only at midnight Pacific starting November 1.

Run `node preview.cjs`, then open:

- October's last day: <http://127.0.0.1:4173/?now=2026-10-31T19:00:00Z>
- November's first day: <http://127.0.0.1:4173/?now=2026-11-01T20:00:00Z>
- October history in November: <http://127.0.0.1:4173/?month=2026-10&now=2026-11-02T20:00:00Z>

All localhost/file previews automatically use browser storage, even without
`test=1`. The preview server supplies an empty Firebase configuration and serves
only app assets, excluding database exports. Each month has separate test data.
Use the existing test participant picker to try multiple people. Test joining
uses the first-points behavior for new people. Returning test members from October
are offered a separate Join November button. A simulated `now`
is frozen until the URL changes; omit it to use the real Pacific date. The month
selector preserves the simulated time. November repeats October's first 30
double-points activities, as agreed.

Run `node verify-months.cjs` for month boundaries (including Pacific daylight
saving time), storage isolation, preview network protection, and read-only guards.

### Testing returning participants

1. Open the October 31 preview above and create a test participant. Use the same
   browser and the same hostname (`127.0.0.1`) for every preview.
2. Open the November 1 preview. If a different test identity is selected, click
   your October participant's name in the test picker and confirm the switch.
3. Press **Join November**. The same identity is reused, no entries are copied,
   and the full November goal starts immediately (6,500 points per day-1 starter).
4. Leave November 1 empty, then open
   <http://127.0.0.1:4173/?now=2026-11-02T20:00:00Z>. November 1 should appear as
   that person's automatic rest day in history.
5. To try a late join, create another October test member, then open
   <http://127.0.0.1:4173/?now=2026-11-10T20:00:00Z>. Select that member and join.
   Their participation starts November 10, with no rest allowance for November 8–14.

Returning members can opt in before November by selecting November while the
simulated date is still October. Logging stays disabled until November begins.
Reset test data clears only the selected month's test data; October is preserved
when resetting November. Membership joining timestamps are simulated locally;
live joining uses immutable Firebase server timestamps and owner/date security rules.
Run `node verify-month-joining.cjs` to check this flow automatically.

### Testing automatic cheerleaders

Join a few differently named participants in the November 1 preview, then open
<http://127.0.0.1:4173/?now=2026-11-02T20:00:00Z>. The first visit after Pacific
November 1 ends generates the November 2–30 schedule. Expand **View your assigned dates**
to inspect your own assigned dates. Members need a saved joining timestamp, but do not need activity
points to qualify. Test members created before timestamps were added should be
recreated using Reset test data in November before this test.

November 1 displays **Everyone cheers today!** with no assigned individual or
individual cheerleader bonus. Later joiners are excluded from the fixed schedule.
No eligible members produces a saved empty schedule. Reset November test data
also resets its schedule. Returning to the app, reconnecting, and polling check
for the schedule; Pacific date rollover refreshes the page when edits are saved.

Local scheduling uses a browser Web Lock when available and a reproducible
shuffled rotation. The result is stored separately from mutable scores/claims,
so later saves cannot erase it. This tests shared tabs in one browser only;
the live version uses the scheduled GitHub job and a Firebase ETag to save exactly once.
Run `node verify-auto-cheer.cjs` for cutoff, fairness, persistence, concurrency,
empty-roster, and delayed-first-visit checks.

Both new and returning November joining forms include a checked **Include me in
the cheerleader rotation** checkbox. Unchecking it opts out without changing
fitness participation or goals. The choice is saved at joining; the current
preview does not offer post-join preference editing. Existing test members with
no saved preference remain opted in. Reset November test data to retest choices
and generation together; an already frozen schedule is never reshuffled.

The schedule panel displays only the current identity's dates, without names or
other people's assignments. Test mode intentionally permits switching identities
for verification. Live database rules restrict private assignment reads to the matching Firebase UID. Local test mode intentionally permits identity switching and is not a security boundary.

## Original October scoring and installation reference

The sections below retain the October setup notes. For the current November launch use SETUP-NOVEMBER.md.

A small-group fitness challenge app originally built for October 2026. Participants
choose 3 activities each day, log progress toward 100 points per activity, and
work together toward a shared team goal.

## Features

- 11 activity choices with per-activity point caps
- Daily 3-activity selection
- Automatic rotating double-points activity
- Team daily total, month total, group goal, and pace status
- Private personal progress panel for the current device
- Public participant list and previous-day 400 club
- Anonymous Firebase identity with owner-only writes
- Browser-only test mode
- Installable Progressive Web App

## Scoring

- Push ups: enter actual reps, 2 points each
- Pull ups: choose Full (10 points per rep) or Modified (2 points per rep). Both cap at 100 base points.
- Squats/Lunges: enter actual reps, 1 point each
- Sit ups: enter actual reps, 1 point each
- Plank: enter actual seconds, 10 points per 30 seconds
- Running/Walking: enter actual minutes, 5 points per 2 completed minutes (100 points at 40 minutes)
- Strength: enter weight-training repetitions, 1 point each
- Dancing/Aerobics: enter combined dancing or aerobics minutes (including video workouts), 4 points per minute
- Stairs: enter actual stairs, 1 point per 4 stairs (100 points at 400 stairs)
- Bird dog: enter actual reps, 2 points each
- Other: enter 0-100 self-assessed points total per day for all unlisted activities.
  100 means doable but challenging for you. Use a consistent standard and do not
  count exercise already logged in another category. This uses one of the three
  daily choices and is never doubled.

For Other, the entered value is limited to 100. For the remaining activities,
the app records the actual amount entered, but each activity is capped at 100
base points. For example, 100 push ups still shows as 100 push ups, but awards
100 base points. The rotating double-points activity can make one selected
activity worth 200 points, so the daily max is 400.

Inclusive movement notes:

- Push ups may be wall pushups, knee pushups, or full pushups.
- Sit ups may be full sit ups or crunches.
- One bird dog rep means a right-left pair.

The group goal is:

```text
sum of (scoring days from each person's participation start through October 31 x 250)
```

Participation starts with first positive points, or an explicit Rest selection on
October 1, 8, 15, or 22. Joining alone adds no goal. Eligible full weeks (1-7,
8-14, 15-21, 22-28) each contribute six scoring days: 1,500 points. Eligibility
requires starting by that week's opening day. October 29-31 has no rest allowance.
The first completed zero-point day becomes Rest automatically if the allowance
is unused; after six scoring days, the seventh is Rest. Rest earns no points.
Additional missed days remain in the goal. Until Rest is assigned, the allowance
is reserved for week-end in daily pace. Dates use Pacific time.

Challenge days follow US Pacific time (`America/Los_Angeles`) for everyone. That
means today's log, yesterday's 400 club, team daily totals, and double-points
days all use the same shared challenge date even when participants are in
different time zones.

## Run Locally

The app has no build step. Serve the folder with a local web server:

```powershell
py -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## Test Mode

Add `?test=1` to the URL:

```text
http://localhost:8000/?test=1
```

Test mode stores participants and progress only in that browser. It does not
read or write Firebase data. The test group starts empty.

## Firebase Setup

1. In Firebase Console, open the separate `october-challenge-2026` project.
2. Register a Web app in Project settings.
3. Copy the Web API key into `firebase-config.js`.
4. Copy your Realtime Database URL into `firebase-config.js`.
5. Enable Authentication -> Sign-in method -> Anonymous.
6. Create a Realtime Database.
7. Publish `database.rules.json` in the new October database Rules tab. This
   file contains October-only rules; do not publish it to September.
8. In Realtime Database -> Data, create `/settingsOctober2026/joinOpen` with Boolean value
   `true`.

Once everyone has joined, set `/settingsOctober2026/joinOpen` to `false`. Existing
participants can keep updating their own entries, but new participant records
will be rejected.

The rules can also be deployed with Firebase CLI:

```powershell
firebase deploy --only database --project october-challenge-2026
```

Live participant data is stored under `/groupChallengeOctober2026/{firebaseUserId}`.

## Invite Participants

After deployment, share the site URL with the join parameter:

```text
https://YOUR-SITE-URL/?join=oct26
```

Each browser/device gets an anonymous Firebase identity. A participant can edit
only the record owned by that identity. Clearing site data creates a new
identity, so participants should not clear browser data during the challenge.

## Privacy Note

The app UI intentionally does not show individual point totals to the group.
Everyone can see:

- who has joined
- who has participated today
- team points for today
- team points for the month
- previous-day 400 club

This is a small-group web app. Authenticated participants can technically read
the shared Firebase data that powers the group totals, but the app does not
present individual scores in the interface. Stronger privacy would require a
server-side aggregation layer such as Cloud Functions.

## Deploy With GitHub Pages

1. Use the separate repository `haagamble/October-challenge-2026`. This
   folder's `origin` points to that repository for both fetch and push. Create
   the empty GitHub repository before the first push; never point this copy
   at `haagamble/group-challenge-2026`.
2. Enable GitHub Pages for the repository's main branch and root folder.
3. Open the published URL and confirm Firebase loads correctly.
4. Visit the invite URL and join from a test device.
5. Confirm that logging activities updates team totals.
6. Install the app on a phone and verify it opens normally.

All files in this folder, including `firebase-config.js`,
`manifest.webmanifest`, `service-worker.js`, `database.rules.json`, and
`icons/`, should be included in the repository.

## October isolation and launch

- The September sibling folder, URL, and records remain the archive.
- October reads and writes only /groupChallengeOctober2026 and reads only
  /settingsOctober2026/joinOpen. The app uses its own `october-challenge-2026` Firebase project.
- Joining defaults to closed when October's setting is absent. Create only
  /settingsOctober2026/joinOpen = true when ready; do not change /settings/joinOpen.
- The invite code is oct26. It is a UI invitation check, not a database secret;
  the existing standalone-app invitation behavior is retained. Database rules
  enforce October's join-open setting and owner-only writes.
- October validates October 1-31, 2026. Day 31 doubles walking; Strength uses October 5, 12, and 28. Other is never doubled. Goals remain 250
  points per scoring day, with one required rest per eligible full week.
  Starting October 9 adds 5,250; October 11 adds 4,750.
- October has independent auth, test, and install-dismissal keys. After the group goal is reached, confetti celebrates once per page load (unless reduced motion is enabled).
- October's worker cleans up only its own cache namespace and uses only its
  own shell cache. Test mode unregisters only the worker at October's scope.
- September's unchanged worker deletes other caches on its origin at activation.
  For guaranteed offline-cache isolation, host October on a separate origin
  (a different hostname). A sibling path or another GitHub Pages repository on
  the same hostname does not provide that isolation.
- The copied group-fitness-2026-default-rtdb-export.json is a September backup,
  not October seed data. Do not import it into October or overwrite the live root.

These are local file changes only. Firebase rules/settings and website deployment
are separate launch steps; no live data has been changed.

Run the local regression checks with `node verify-october.cjs` from this folder.

## Rest-day launch checks

Publish the October rule changes before launching this version: October entries
now allow `{ "rest": true }`, mutually exclusive with activity fields. Publish only to the October project. Weekly eligibility and automatic
rest are calculated by the client from entries; these are not server-enforced
anti-cheating rules. Automatic rest requires no background job or database write.
Manual Rest can only be selected today and lasts for that day. The weekly
double-points schedule is read-only. Run `node verify-rest.cjs` as well as
`node verify-october.cjs` before release.

Combined activities: existing running and walking selections are merged on load,
with their minutes summed under walking and a shared 100-point base cap. Old
running values remain permitted by the rules for compatibility. Strength uses
the former running double days (October 5, 12, 28). Existing October scores may
therefore recalculate under the new categories and schedule. Publish the updated
October database rules before using Strength. No live records are migrated by
this file update; a participant saves their normalized record on their next edit.

Pull-up type is saved per entry as pullupType (full or modified). Missing types
retain Full scoring. The last successful selection is remembered locally per
participant, project, and test/live mode. Publish the updated October rules
before deploying this version so type selections can be saved.

## Cheerleader setup (Spark plan, October project only)

Publish the updated database.rules.json before deploying this app version.
The code reads cheerleaderScheduleOctober2026 and cheerleaderClaimsOctober2026.
Schedule entries contain uid, startAt, and endAt (epoch milliseconds for the
Pacific day). Only an organizer using the Firebase Console can edit assignments;
client rules deny all schedule writes. Claims require the assigned authenticated
participant, a participant record, the server-time day window, and a valid status.
Claims store accepted, passed, or claimed, never an editable number of points.
Only claimed entries earn 100; repeated claims cannot multiply the award.

1. Manually choose October 1's participant from groupChallengeOctober2026 and
   copy their ID. Create a local .private-cheerleader folder (ignored by Git).
2. Generate October 1 only (run from the October app folder):
   node make-cheerleader-schedule.cjs --first-day OCTOBER_1_UID .private-cheerleader/day-one.json
3. Create/select cheerleaderScheduleOctober2026 in October's Firebase Data tab.
   Import day-one.json at THAT NODE ONLY, never the database root. Importing
   replaces the selected node. Check the console path before importing.
4. At the end of October 1 Pacific time, export ONLY groupChallengeOctober2026
   into .private-cheerleader/roster.json. This must be the frozen cutoff roster,
   not a later export containing later joiners. The app has no reliable joinedAt
   field for reconstructing this cutoff retrospectively; review the roster if late.
5. Generate the full schedule:
   node make-cheerleader-schedule.cjs .private-cheerleader/roster.json OCTOBER_1_UID .private-cheerleader/schedule.json
6. Review, then import schedule.json at cheerleaderScheduleOctober2026 only.
   October 1 stays assigned to the same person. Claim records are in a separate
   node and are not replaced. Turn counts include October 1; the remaining days
   go to the least-assigned participant, with a stable shuffled tie order.
   Later participants do not change the schedule. No Cloud Function is needed.

Do not commit the roster or generated schedule. The generator writes a new file
and refuses to overwrite one. It neither connects to Firebase nor runs Git.
A missing assignment shows no card. Failed schedule/claim reads show a notice and
disable claims, while retaining previously loaded bonuses. Passing leaves the
day unassigned to anyone else. Accept can reverse a pass on the same day.
Bonuses count in personal/team totals and daily history, not activity averages,
the goal, participation starts, or rest-day eligibility. The 400 Club includes claimed bonuses. The daily
team statistics total includes bonuses; its logged-person count remains activity-only.

Run node verify-cheerleader.cjs for local behavior and rule-expression checks.
Live Firebase Rules Playground checks are still required before launch: another
UID, direct claim before acceptance, extra fields, deletion, before/after the
assignment window, and schedule writes must fail; accept/claim/undo by the
assigned participant during their day must succeed.

## Publishing app updates

For every release (including text-only edits), increase the numeric app-version
meta tag in index.html, the oct2026-N asset query versions in that file, and the
vN cache version in service-worker.js together. Update the cache fixture in
verify-october.cjs to match. Publish these files together through GitHub Pages.

The app checks the published index.html without HTTP caching on return to the
foreground, on reconnect, and every two minutes while visible. A newer release
reloads automatically when online and there is no focused input, unsaved activity
input, join name, activity/rest save, or cheerleader save. Failed activity saves
keep the automatic reload blocked until the participant successfully saves that
activity again. Firebase data continues to refresh separately.

Participants need one manual refresh to receive this update mechanism initially.
Run node verify-updates.cjs for the update and save-protection checks. After
deployment, verify on an installed phone app by leaving one release open and
publishing the next version, including a check while an activity field is edited.
